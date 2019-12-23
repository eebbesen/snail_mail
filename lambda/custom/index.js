/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core');
const moment = require('moment-timezone');
const { version } = require('./package.json');
require('isomorphic-fetch');

const USPS_PARAMS = {maxDistance:"1",lbro:"",requestType:"collectionbox",requestServices:"",requestRefineTypes:"",requestRefineHours:""}

const logger = function(...args) {
  console.log(`SNAILMAIL ${version}:`, ...args);
}

const getBoxes = async function(address) {
  const data = JSON.stringify(Object.assign({}, USPS_PARAMS, transformAddressData(address)));

  return await fetch("https://tools.usps.com/UspsToolsRestServices/rest/POLocator/findLocations",
  {
    credentials:"include",
    headers: {
      "accept":"application/json, text/javascript, */*; q=0.01",
      "accept-language":"en-US,en;q=0.9,de;q=0.8,el;q=0.7,ja;q=0.6,zh;q=0.5,de-DE;q=0.4",
      "content-type":"application/json;charset=UTF-8",
      "sec-fetch-mode":"cors",
      "sec-fetch-site":"same-origin",
      "x-requested-with":"XMLHttpRequest"
    },
    referrer:"https://tools.usps.com/find-location.htm",
    referrerPolicy:"no-referrer-when-downgrade",
    body: data,
    method:"POST",
    mode:"cors"
  })
  .then(response => {
    return response.json();
  });
};

const parseJson = function(json) {
  const records = new Array();

  json.locations.forEach(r => {
    const hours = new Map();
    r.locationServiceHours[0].dailyHoursList.forEach(h => {
      if (h.times && h.times[0] &&  h.times[0].close){
        hours.set(h.dayOfTheWeek, h.times[0].close)
      }
    });

    records.push({
      distance: r.distance,
      link: '',
      street: r.address1,
      city: r.city,
      state: r.state,
      zip: r.zip5,
      hours: hours
    });
  });

  return records;
};

// convert String time to Integer
// 0 means no time -- not using String or null for type safety
const twelveToTwentyFour = function(time){
  if (time.indexOf(':') < 0 ) {
    return 0
  } else if (time.indexOf('am') > 0) {
    let t = parseInt(time.replace(/\D/g, ''));
    if (time.indexOf('12:') === 0) {
      t -= 1200;
    }
    return t;
  } else {
    let t = parseInt(time.replace(/\D/g, ''));
    if (time.indexOf('12:') === 0) {
      t -= 2400;
    }
    return t + 1200;
  }
};

const expandTimesMap = function(map) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const times = new Map();

  for (k of map.keys()) {
    const regex = `^${k}`
    const d = days.find(w => {
      return w.toUpperCase().match(regex)}
    )
    times.set(d, map.get(k))
  }

  return times;
};

const nextPickupTime = function(times, timeZone) {
  const deviceTime = moment.tz(timeZone);
  const day = deviceTime.format('dddd');
  const currentHourMin = parseInt(deviceTime.format('H') + deviceTime.format('mm'));
  const lastPickUpToday = times.get(day) ? times.get(day) : null;

  let pickUpDay;
  let pickUpTime;

  if(lastPickUpToday != null && lastPickUpToday.replace(':','') > currentHourMin) {
    pickUpDay = 'Today';
    pickUpTime = times.get(day);
  } else {
    let ndc = 1;
    let nextDay;
    while (times.get(nextDay) === undefined) {
      nextDay = moment().add(ndc++, 'days').format('dddd');
    }

    pickUpDay = nextDay;
    pickUpTime = times.get(nextDay);
  }

  return `${pickUpDay} at ${convertTime(pickUpTime)}`;
};

const transformAddressData = function(addressData) {
  return {
    requestCity: addressData.city,
    requestState: addressData.stateOrRegion,
    requestAddressL1: addressData.addressLine1,
    requestZipCode: transformZipCode(addressData.postalCode)
  };
};

const transformZipCode = function(zipCode) {
  let pc = zipCode;

  if (pc) {
    pc = pc.substring(0, 5);
  }

  return pc;
};

// assumes API provides pickup times in local time zone
const boxLocationCall = async function(addressData, timeZone) {
  logger('addressData', addressData)
  const boxData = await getBoxes(addressData);
  logger('boxData', boxData)
  const recs = parseJson(boxData);
  logger('recs', recs);

  let response1 = 'Sorry, I could not find any mailboxes near you. Please make sure your Alexa device has your correct address entered';
  if (recs && recs.length > 0) {
    const rec = recs[0]
    logger('before distance call');
    response1 = `Your closest mailbox is ${roundDistance(rec.distance)} miles away at ${rec.street} in ${rec.city}.`;
    logger('after distance call');
    const expandTimes = expandTimesMap(rec.hours);
    const npt = nextPickupTime(expandTimes, timeZone);
    logger('after pickup time call');
    if (npt) {
      response1 += ` Your next pickup time is ${npt}`;
    }
  }

  return response1;
};

const roundDistance = function(distance) {
  let d = parseFloat(distance);

  if (d > 1) {
    return Math.round(d);
  } else {
    return parseFloat(d.toPrecision(1));
  }
};

const convertTime = function(time) {
  return moment(time, 'HH:mm').format('h:mm A');
}

const executor = async function(handlerInput) {
  logger('CollectionBoxIntentHandler');
  logger(JSON.stringify(handlerInput.requestEnvelope, null, 2));
  const { requestEnvelope, serviceClientFactory, responseBuilder } = handlerInput;

  const consentToken = requestEnvelope.context.System.user.permissions
    && requestEnvelope.context.System.user.permissions.consentToken;
  if (!consentToken) {
    return responseBuilder
      .speak('Please grant me permission to access your device address. Without this permission I cannot find collection boxes near you!')
      .getResponse();
  }

  try {
    const { deviceId } = requestEnvelope.context.System.device;
    const directiveServiceClient = handlerInput.serviceClientFactory.getDirectiveServiceClient();
    const deviceAddressServiceClient = serviceClientFactory.getDeviceAddressServiceClient();
    const upsServiceClient = serviceClientFactory.getUpsServiceClient();

    // let the user know we're working on it...
    const pr = await progressiveResponse(requestEnvelope, directiveServiceClient);
    logger(pr);

    const address = await deviceAddressServiceClient.getFullAddress(deviceId);
    const timeZone = await upsServiceClient.getSystemTimeZone(deviceId);
    // logger('Address successfully retrieved, now responding to user.', address);

    const responseText = await boxLocationCall(address, timeZone);
    logger('responseText', responseText);
    return responseBuilder
      .speak(responseText)
      .getResponse();
  } catch (error) {
    if (error.name !== 'ServiceError') {
      logger(error);
      const response = responseBuilder.speak('there was an error').getResponse();
      return response;
    }
    throw error;
  }
};

// https://github.com/alexa/alexa-cookbook/blob/master/feature-demos/skill-demo-progressive-response/lambda/custom/index.js
const progressiveResponse = function(requestEnvelope, directiveServiceClient) {
  // Call Alexa Directive Service.
  const requestId = requestEnvelope.request.requestId;
  const endpoint = requestEnvelope.context.System.apiEndpoint;
  const token = requestEnvelope.context.System.apiAccessToken;

  // build the progressive response directive
  const directive = {
    header: {
      requestId,
    },
    directive: {
      type: 'VoicePlayer.Speak',
      speech: 'Looking for boxes near your location',
    },
  };

  // send directive
  return directiveServiceClient.enqueue(directive, endpoint, token);
};

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput) {
    return executor(handlerInput);
  },
};

const CollectionBoxIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'CollectionBoxIntent';
  },
  async handle(handlerInput) {
    return executor(handlerInput);
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    logger('HelpIntentHandler');
    const speechText = 'I will tell you where to find USPS collection boxes. They are the blue ones into which you put mail you want to send.';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('I will tell you where to find USPS collection boxes if you have assigned an address to your device and granted me access to that address', speechText)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    logger('CancelAndStopIntentHandler');
    const speechText = 'Goodbye!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Ciao', speechText)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    logger('SessionEndedRequestHandler');
    logger(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    logger('ErrorHandler');
    logger(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak('Sorry, I can\'t understand the command. Please say again.')
      .reprompt('Sorry, I can\'t understand the command. Please say again.')
      .getResponse();
  },
};

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    CollectionBoxIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .withApiClient(new Alexa.DefaultApiClient())
  .addErrorHandlers(ErrorHandler)
  .lambda();

exports.boxLocationCall = boxLocationCall;
exports.convertTime = convertTime;
exports.expandTimesMap = expandTimesMap;
exports.getBoxes = getBoxes;
exports.nextPickupTime = nextPickupTime;
exports.parseJson = parseJson;
exports.roundDistance = roundDistance;
exports.transformAddressData = transformAddressData;
exports.transformZipCode =transformZipCode;
exports.twelveToTwentyFour = twelveToTwentyFour;