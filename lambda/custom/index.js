/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core');
const cheerio = require('cheerio');
require('isomorphic-fetch');

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
    const rr = new Array();
    $(this).find('.hoursTable_hours').find('li').each(function (i, o) {
      const key = $(this).find('.days').text();
      const val = $(this).find('.hours').text().replace(/(\t|\n)/g, '');
      if ((key + val).trim().length > 1) {
        rr[key] = val;
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

const lambdaServiceWrapper = function(handlerInput) {
  console.log('aaaaaa', handlerInput);
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

  console.log('bbbbbb', requestAttributes, 'sssss', sessionAttributes);
  if (this.event && this.event.context.System.user.permissions) {
    const requestId = this.event.request.requestId;
    const token = this.event.context.System.user.permissions.consentToken;
    const apiEndpoint = this.event.context.System.apiEndpoint;
    const deviceId = this.event.context.System.device.deviceId;
    const ds = new Alexa.services.DirectiveService();
    const das = new Alexa.services.DeviceAddressService();
    const directive = new Alexa.directives.VoicePlayerSpeakDirective(requestId, 'Looking for boxes. Boop beep bop boop beep bop beep!');

    const progressiveResponse = ds.enqueue(directive, apiEndpoint, token)
      .catch((err) => {
        console.log('SNAILMAIL: error in progressiveResponse:', err)
      });

    const getAddress = das.getFullAddress(deviceId, apiEndpoint, token)
      .then((data) => {
        boxLocationCall(data)
          .then(location => {
            return handlerInput.responseBuilder
              .speak(location);
          })
      })
      .catch((error) => {
        console.log('SNAILMAIL: getAddress promise error:', error.message)
        return handlerInput.responseBuilder
          .speak(location);
      });

    Promise.all([progressiveResponse, getAddress])
      .then(() => {});
  } else {
    return handlerInput.responseBuilder
      .speak('Please grant me permission to access your device address. Without this permission I cannot find collection boxes near you!');

  }
};

const boxLocationCall = async function(addressData) {
  const address = [addressData.addressLine1, addressData.city, addressData.stateOrRegion, addressData.postalCode].join(', ')
  const boxData = await getBoxes(address);
  console.log('SNAILMAIL: boxData', boxData);
  const rec = parseHtml(boxData)[0];
  console.log('SNAILMAIL: recs', rec);

  let response1 = 'Sorry, I could not find any mailboxes near you. Please make sure your Alexa device has your correct address entered';
  if (rec && rec.distance) {
    response1 = `Your closest mailbox is ${rec.distance} miles away at ${rec.street} in ${rec.city}.`;
  }

  return response1;
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput) {
    console.log('SNAILMAIL:', 'CollectionBoxIntentHandler');
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
      const deviceAddressServiceClient = serviceClientFactory.getDeviceAddressServiceClient();
      const address = await deviceAddressServiceClient.getFullAddress(deviceId);
      // console.log('SNAILMAIL:', 'Address successfully retrieved, now responding to user.', address);

      const responseText = await boxLocationCall(address);
      console.log('SNAILMAIL: responseText', responseText);
      return responseBuilder
        .speak(responseText)
        .getResponse();
    } catch (error) {
      if (error.name !== 'ServiceError') {
        console.log('SNAILMAIL:', error);
        const response = responseBuilder.speak('there was an error').getResponse();
        return response;
      }
      throw error;
    }
  },
};

const CollectionBoxIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'CollectionBoxIntent';
  },
  async handle(handlerInput) {
    console.log('SNAILMAIL:', 'CollectionBoxIntentHandler');
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
      const deviceAddressServiceClient = serviceClientFactory.getDeviceAddressServiceClient();
      const address = await deviceAddressServiceClient.getFullAddress(deviceId);
      // console.log('SNAILMAIL:', 'Address successfully retrieved, now responding to user.', address);

      const responseText = await boxLocationCall(address);
      console.log('SNAILMAIL: responseText', responseText);
      return responseBuilder
        .speak(responseText)
        .getResponse();
    } catch (error) {
      if (error.name !== 'ServiceError') {
        console.log('SNAILMAIL:', error);
        const response = responseBuilder.speak('there was an error').getResponse();
        return response;
      }
      throw error;
    }
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    console.log('SNAILMAIL:', 'HelpIntentHandler');
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
    console.log('SNAILMAIL:', 'CancelAndStopIntentHandler');
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
    console.log('SNAILMAIL:', 'SessionEndedRequestHandler');
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log('SNAILMAIL:', 'ErrorHandler');
    console.log('SNAILMAIL:', `Error handled: ${error.message}`);

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
exports.parseHtml = parseHtml;
exports.getBoxes = getBoxes;