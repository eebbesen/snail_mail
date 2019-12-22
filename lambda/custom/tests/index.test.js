process.env.NODE_ENV = 'test';

const index = require('../index');
const moment = require('moment');

const USPS_RESPONSE = {
  "locations": [
    {
      "locationID": "5510500003",
      "locationName": "USPS COLLECTION BOX - BLUE BOX",
      "locationType": "collectionbox",
      "radius": "1",
      "address1": "1652 GRAND AVE",
      "city": "SAINT PAUL",
      "state": "MN",
      "zip5": "55105",
      "latitude": "44.940006282",
      "longitude": "-93.170336866",
      "distance": "0.20083",
      "locationServiceHours": [
        {
          "name": "LASTCOLLECTION",
          "dailyHoursList": [
            {
              "dayOfTheWeek": "MO",
              "times": [
                {
                  "close": "15:00:00"
                }
              ]
            },
            {
              "dayOfTheWeek": "TU",
              "times": [
                {
                  "close": "15:00:00"
                }
              ]
            },
            {
              "dayOfTheWeek": "WE",
              "times": [
                {
                  "close": "15:00:00"
                }
              ]
            },
            {
              "dayOfTheWeek": "TH",
              "times": [
                {
                  "close": "15:00:00"
                }
              ]
            },
            {
              "dayOfTheWeek": "FR",
              "times": [
                {
                  "close": "15:00:00"
                }
              ]
            },
            {
              "dayOfTheWeek": "SA",
              "times": [
                {
                  "close": "11:00:00"
                }
              ]
            },
            {
              "dayOfTheWeek": "SU",
              "times": []
            }
          ]
        }
      ],
      "preferredSort": "1",
      "holdMailFacility": false,
      "accountableMailFacility": false,
      "showNotice": "Y",
      "specialMessage": "ON 12/24 AND 12/31, THIS BOX MAY BE COLLECTED AS EARLY AS 12 NOON."
    },
    {
      "locationID": "5510500042",
      "locationName": "USPS COLLECTION BOX - BLUE BOX",
      "locationType": "collectionbox",
      "radius": "1",
      "address1": "1652 GRAND AVE",
      "city": "SAINT PAUL",
      "state": "MN",
      "zip5": "55105",
      "latitude": "44.940006282",
      "longitude": "-93.170336866",
      "distance": "0.20083",
      "locationServiceHours": [
        {
          "name": "LASTCOLLECTION",
          "dailyHoursList": [
            {
              "dayOfTheWeek": "MO",
              "times": [
                {
                  "close": "15:00:00"
                }
              ]
            },
            {
              "dayOfTheWeek": "TU",
              "times": [
                {
                  "close": "15:00:00"
                }
              ]
            },
            {
              "dayOfTheWeek": "WE",
              "times": [
                {
                  "close": "15:00:00"
                }
              ]
            },
            {
              "dayOfTheWeek": "TH",
              "times": [
                {
                  "close": "15:00:00"
                }
              ]
            },
            {
              "dayOfTheWeek": "FR",
              "times": [
                {
                  "close": "15:00:00"
                }
              ]
            },
            {
              "dayOfTheWeek": "SA",
              "times": [
                {
                  "close": "11:00:00"
                }
              ]
            },
            {
              "dayOfTheWeek": "SU",
              "times": []
            }
          ]
        }
      ],
      "preferredSort": "2",
      "holdMailFacility": false,
      "accountableMailFacility": false,
      "showNotice": "Y",
      "specialMessage": "ON 12/24 AND 12/31, THIS BOX MAY BE COLLECTED AS EARLY AS 12 NOON."
    }
  ]
};

const ADDRESS_DATA = {
  addressLine1: '1600 Grand Ave',
  city: 'Saint Paul',
  stateOrRegion: 'MN',
  postalCode: '55105'
};

test('distance less than one mile to have decimal', () => {
  expect(index.roundDistance('0.78')).toEqual(0.8);
  expect(index.roundDistance(0.71)).toEqual(0.7);
});

test('distance more than one mile to round', () => {
  expect(index.roundDistance('1.78')).toEqual(2);
  expect(index.roundDistance('3.08')).toEqual(3);
});

test('integration: gets mailboxes with address', async () => {
  console.log('********** REALLY HITS USPS WEB API **********');
  const res = await index.getBoxes(ADDRESS_DATA);
  const records = index.parseJson(res);

  expect(records.length).toBeGreaterThan(2);
  const rec = records[0];
  expect(rec.distance).toEqual('0.20083');
  expect(rec.street).toEqual('1652 GRAND AVE');
  expect(rec.city).toEqual('SAINT PAUL');
  expect(rec.state).toEqual('MN');
  expect(rec.zip).toEqual('55105');
  expect(rec.hours.get('MO')).toBe('15:00:00');
});

test('builds address data PO expects from device address', () => {
  expect(index.transformAddressData(ADDRESS_DATA)).
    toEqual({
      requestCity: 'Saint Paul',
      requestState: 'MN',
      requestAddressL1: '1600 Grand Ave',
      requestZipCode: '55105'
    });
});

test('gets next pickup time current day', () => {
  const today = moment().format('dddd');

  const times = new Map();
  switch(today){
    case 'Sunday':
      times.set('SA', '01:00');
      times.set('SU', '23:59');
      break;
    case 'Saturday':
      times.set('MO', '01:00');
      times.set('TU', '01:00');
      times.set('WE', '01:00');
      times.set('TH', '01:00');
      times.set('FR', '01:00');
      times.set('SA', '23:59');
      break;
    default:
      times.set('MO', '23:59');
      times.set('TU', '23:59');
      times.set('WE', '23:59');
      times.set('TH', '23:59');
      times.set('FR', '23:59');
      times.set('SA', '10:00');
    }
  const hours = index.expandTimesMap(times);
  const result = index.nextPickupTime(hours,'America/New_York');

  expect(result).toEqual('Today at 23:59');
});

test('gets next pickup time next day', () => {
  const times = new Map();
  times.set('MO', '00:01');
  times.set('TU', '00:01');
  times.set('WE', '00:01');
  times.set('TH', '00:01');
  times.set('FR', '00:01');
  times.set('SA', '00:01');
  times.set('SU', '00:01');
  const hours = index.expandTimesMap(times);

  const result = index.nextPickupTime(hours,'America/New_York');

  const nextDay = moment().add(1, 'days').format('dddd')
  expect(result).toEqual(`${nextDay} at 00:01`);
});

test('gets next pickup time none tomorrow', () => {
  const today = moment().format('dddd');
  const twoDaysAhead = moment().add(2, 'days').format('dddd');
  const hours = new Map();
  hours.set(today, '00:01');
  hours.set(twoDaysAhead, '23:59');

  const result = index.nextPickupTime(hours,'America/New_York');

  const nextDay = moment().add(2, 'days').format('dddd')
  expect(result).toEqual(`${nextDay} at 23:59`);
});

test('gets next pickup time none today', () => {
  const twoDaysAhead = moment().add(2, 'days').format('dddd');
  const hours = new Map();
  hours.set(twoDaysAhead, '23:59');

  const result = index.nextPickupTime(hours,'America/New_York');

  const nextDay = moment().add(2, 'days').format('dddd')
  expect(result).toEqual(`${nextDay} at 23:59`);
});

test('expands times map', () => {
  const times = new Map();
  times.set('MO', '15:00');
  times.set('TU', '15:00');
  times.set('WE', '15:00');
  times.set('TH', '15:00');
  times.set('FR', '15:00');
  times.set('SA', '11:00');

  const result = index.expandTimesMap(times);

  expect(result.get('Monday')).toEqual('15:00');
  expect(result.get('Tuesday')).toEqual('15:00');
  expect(result.get('Wednesday')).toEqual('15:00');
  expect(result.get('Thursday')).toEqual('15:00');
  expect(result.get('Friday')).toEqual('15:00');
  expect(result.get('Saturday')).toEqual('11:00');
});

test('expands times map Sat-Sun', () => {
  const times = new Map();
  times.set('SA', '15:00');
  times.set('SU', '15:00');

  const result = index.expandTimesMap(times);

  expect(result.get('Saturday')).toEqual('15:00');
  expect(result.get('Sunday')).toEqual('15:00');
});

test('expands times map removes closed', () => {
  const times = new Map();

  const result = index.expandTimesMap(times);

  expect(result.size).toBe(0);
});
