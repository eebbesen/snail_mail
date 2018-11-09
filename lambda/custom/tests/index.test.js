process.env.NODE_ENV = 'test';

const index = require('../index');
const moment = require('moment');

const RECORDS = `
[ { distance: '0.1',
    link:
     '/go/POLocatorDetailsAction!input.action?locationTypeQ=collectionbox&address=1600+Grand+Avenue+saint+paul+mn&radius=20&locationType=collectionbox&locationID=5510500023&locationName=USPS+COLLECTION+BOX+-+BLUE+BOX&address2=&address1=1579+GRAND+AVE&city=SAINT+PAUL&state=MN&zip5=55105&zip4=&tollFree=&fax=&latitude=44.940307&longitude=-93.1669147&sWithin=20&&&&&&&&&',
    street: '1579 GRAND AVE',
    city: 'SAINT PAUL',
    state: 'MN',
    zip: '55105',
    hours: [ 'Mon-Fri': '4:00pm', Sat: '11:00am', Sun: 'Closed' ] },
  { distance: '0.1',
    link:
     '/go/POLocatorDetailsAction!input.action?locationTypeQ=collectionbox&address=1600+Grand+Avenue+saint+paul+mn&radius=20&locationType=collectionbox&locationID=5510500003&locationName=USPS+COLLECTION+BOX+-+BLUE+BOX&address2=&address1=1652+GRAND+AVE&city=SAINT+PAUL&state=MN&zip5=55105&zip4=&tollFree=&fax=&latitude=44.940024&longitude=-93.1702559&sWithin=20&&&&&&&&&',
    street: '1652 GRAND AVE',
    city: 'SAINT PAUL',
    state: 'MN',
    zip: '55105',
    hours: [ 'Mon-Fri': '3:00pm', Sat: '11:00am', Sun: 'Closed' ] }
]`;

test('integration: gets mailboxes with address', async () => {
  console.log('********** REALLY HITS USPS WEB API **********');
  const res = await index.getBoxes('1600 Grand Avenue saint paul mn');
  const records = index.parseHtml(res);
  expect(records.length).toBeGreaterThan(1);
  const rec = records[0];
  expect(rec.distance).toEqual('0.1');
  expect(rec.street).toEqual('1579 GRAND AVE');
  expect(rec.city).toEqual('SAINT PAUL');
  expect(rec.state).toEqual('MN');
  expect(rec.zip).toEqual('55105');
  expect(rec.hours['Mon-Fri']).toBe('4:00pm');
});

test('gets next pickup time current day', () => {
  const times = new Map();
  times.set('Mon-Fri', '11:59pm');
  times.set('Sat', '10:00am');
  times.set('Sun', 'Closed');

  const result = index.nextPickupTime(times,'America/New_York');

  expect(result).toEqual('Today at 11:59pm');
});

test('gets next pickup time next day', () => {
  const times = new Map();
  times.set('Mon-Fri', '12:01am');
  times.set('Sat', '12:01am');
  times.set('Sun', 'Closed');

  const result = index.nextPickupTime(times,'America/New_York');

  const nextDay = moment().add(1, 'days').format('dddd')
  expect(result).toEqual(`${nextDay} at 12:01am`);
});

test('expands times map', () => {
  const times = new Map();
  times.set('Mon-Fri', '3:00pm');
  times.set('Sat', '11:00am');
  times.set('Sun', 'Closed');

  const result = index.expandTimesMap(times);

  expect(result.get('Monday')[0]).toEqual(1500);
  expect(result.get('Monday')[1]).toEqual('3:00pm');
  expect(result.get('Tuesday')[0]).toEqual(1500);
  expect(result.get('Tuesday')[1]).toEqual('3:00pm');
  expect(result.get('Wednesday')[0]).toEqual(1500);
  expect(result.get('Wednesday')[1]).toEqual('3:00pm');
  expect(result.get('Thursday')[0]).toEqual(1500);
  expect(result.get('Thursday')[1]).toEqual('3:00pm');
  expect(result.get('Friday')[0]).toEqual(1500);
  expect(result.get('Friday')[1]).toEqual('3:00pm');
  expect(result.get('Saturday')[0]).toEqual(1100);
  expect(result.get('Saturday')[1]).toEqual('11:00am');
});

test('handles "Closed" in time conversion', () => {
  const result = index.twelveToTwentyFour('Closed');

  expect(result).toEqual(0);
});

test('handles am in time conversion', () => {
  const result = index.twelveToTwentyFour('11:00am');

  expect(result).toEqual(1100);
});

test('handles pm in time conversion', () => {
  const result = index.twelveToTwentyFour('2:00pm');

  expect(result).toEqual(1400);
});
