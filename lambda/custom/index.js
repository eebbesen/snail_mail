/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core');
const cheerio = require('cheerio');
const moment = require('moment-timezone');
const { version } = require('./package.json');
require('isomorphic-fetch');

const logger = function(...args) {
  console.log(`SNAILMAIL ${version}:`, ...args);
}

const getBoxes = async function(address) {
  const url = `https://tools.usps.com/go/POLocatorAction.action?locationTypeQ=collectionbox&address=${encodeURI(address)}`

  return await fetch(url)
    .then(response => {
      return response.text();
    });
};

const parseHtml = function(html) {
  const records = new Array();
  const $ = cheerio.load(html.toString());
  $('.result').each(function(i, r) {
    const rr = new Map();
    $(this).find('.hoursTable_hours').find('li').each(function (i, o) {
      const key = $(this).find('.days').text();
      const val = $(this).find('.hours').text().replace(/(\t|\n)/g, '');
      if ((key + val).trim().length > 1) {
        rr.set(key, val);
      }
    });

    records.push({
      distance: $(this).find('.mile').text(),
      link: $(this).find('#po-details-link').attr('href'),
      street: $(this).find('#address').text(),
      city: $(this).find('#city').text(),
      state: $(this).find('#state').text(),
      zip: $(this).find('#zip5').text(),
      hours: rr,
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
  const times = new Map();
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const keys = map.keys();
  for (k of keys) {
    switch(k) {
      case 'Mon-Fri':
        const tmf = map.get('Mon-Fri');
        if (tmf != 'Closed') {
          weekdays.forEach(d => { times.set(d, [twelveToTwentyFour(tmf), tmf])});
        }
        break;
      case 'Sat':
        const tsa = map.get('Sat');
        if (tsa != 'Closed') {
          times.set('Saturday', [twelveToTwentyFour(tsa), tsa]);
        }
        break;
      case 'Sun':
        const tsu = map.get('Sun');
        if (tsu != 'Closed') {
          times.set('Sunday', [twelveToTwentyFour(tsu), tsu]);
        }
        break;
      case 'Sat-Sun':
        const tss = map.get('Sat-Sun');
        if (tss != 'Closed') {
          times.set('Saturday', [twelveToTwentyFour(tss), tss]);
          times.set('Sunday', [twelveToTwentyFour(tss), tss]);
        }
        break;
      default:
        logger(`NO ENTRY FOR ${k}`);
    };
  }

  return times;
};

const nextPickupTime = function(times, timeZone) {
  const deviceTime = moment.tz(timeZone);
  const day = deviceTime.format('dddd');
  const currentHourMin = parseInt(deviceTime.format('H') + deviceTime.format('mm'));

  const lastPickUpToday = times.get(day) ? times.get(day)[0] : 0;
  let pickUpDay;
  let pickUpTime;

  if(lastPickUpToday > currentHourMin) {
    pickUpDay = 'Today';
    pickUpTime = times.get(day)[1];
  } else {
    let nextDay = moment().add(1, 'days').format('dddd');
    if (times.get(nextDay) === undefined) {
      nextDay = moment().add(2, 'days').format('dddd');
    }

    pickUpDay = nextDay;
    pickUpTime = times.get(nextDay)[1];
  }

  return `${pickUpDay} at ${pickUpTime}`;
};

// assumes API provides pickup times in local time zone
const boxLocationCall = async function(addressData, timeZone) {
  const address = [addressData.addressLine1, addressData.city, addressData.stateOrRegion, addressData.postalCode].join(', ')
  const boxData = await getBoxes(address);
  logger('boxData', boxData);
  const rec = parseHtml(boxData)[0];
  logger('recs', rec);

  let response1 = 'Sorry, I could not find any mailboxes near you. Please make sure your Alexa device has your correct address entered';
  if (rec && rec.distance) {
    logger('before distance call');
    response1 = `Your closest mailbox is ${rec.distance} miles away at ${rec.street} in ${rec.city}.`;
    logger('after distance call');
    const expandTimes = expandTimesMap(rec.hours);
    const npt = nextPickupTime(expandTimes, timeZone);
    logger('after pickup time call');
    if (npt) {
      response1 += ` Your next pickup time is ${npt}`;
    }
  }

  return response1;
}

const executor = async function(handlerInput) {
  logger('CollectionBoxIntentHandler');
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
    logger(responseText', responseText);
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
      speech: 'Looking for boxes. Boop beep bop boop beep bop beep! Blurp.',
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
exports.expandTimesMap = expandTimesMap;
exports.getBoxes = getBoxes;
exports.nextPickupTime = nextPickupTime;
exports.parseHtml = parseHtml;
exports.twelveToTwentyFour = twelveToTwentyFour;