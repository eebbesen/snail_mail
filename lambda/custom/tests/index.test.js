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
  expect(rec.hours.get('Mon-Fri')).toBe('4:00pm');
});

// test.only('integration: gets mailboxes with address', async () => {
//   console.log('********** REALLY HITS USPS WEB API **********');
//   const res = await index.getBoxes('55101');
//   const records = index.parseHtml(res);
//   expect(records.length).toBeGreaterThan(1);
//   const rec = records[0];
//   console.log(rec)
//   // expect(rec.distance).toEqual('0.1');
//   // expect(rec.street).toEqual('1579 GRAND AVE');
//   // expect(rec.city).toEqual('SAINT PAUL');
//   // expect(rec.state).toEqual('MN');
//   // expect(rec.zip).toEqual('55105');
//   // expect(rec.hours.get('Mon-Fri')).toBe('4:00pm');
// });

// add test for Sat-Sun

test('gets next pickup time current day', () => {
  const today = moment().format('dddd');

  const times = new Map();
  switch(today){
    case 'Sunday':
      times.set('Mon-Fri', 'Closed');
      times.set('Sat', '1:00am');
      times.set('Sun', '11:59pm');
      break;
    case 'Saturday':
      times.set('Mon-Fri', '1:00am');
      times.set('Sat', '11:59pm');
      times.set('Sun', 'Closed');
      break;
    default:
      times.set('Mon-Fri', '11:59pm');
      times.set('Sat', '10:00am');
      times.set('Sun', 'Closed');
    }
  const hours = index.expandTimesMap(times);

  const result = index.nextPickupTime(hours,'America/New_York');

  expect(result).toEqual('Today at 11:59pm');
});

test('gets next pickup time next day', () => {
  const times = new Map();
  times.set('Mon-Fri', '12:01am');
  times.set('Sat', '12:01am');
  times.set('Sun', '12:01am');
  const hours = index.expandTimesMap(times);

  const result = index.nextPickupTime(hours,'America/New_York');

  const nextDay = moment().add(1, 'days').format('dddd')
  expect(result).toEqual(`${nextDay} at 12:01am`);
});

test('gets next pickup time none tomorrow', () => {
  const today = moment().format('dddd');
  const twoDaysAhead = moment().add(2, 'days').format('dddd');
  const hours = new Map();
  hours.set(today, [1, '12:01am']);
  hours.set(twoDaysAhead, [2359, '11:59pm']);

  const result = index.nextPickupTime(hours,'America/New_York');

  const nextDay = moment().add(2, 'days').format('dddd')
  expect(result).toEqual(`${nextDay} at 11:59pm`);
});

test('gets next pickup time none today', () => {
  const twoDaysAhead = moment().add(2, 'days').format('dddd');
  const hours = new Map();
  hours.set(twoDaysAhead, [2359, '11:59pm']);

  const result = index.nextPickupTime(hours,'America/New_York');

  const nextDay = moment().add(2, 'days').format('dddd')
  expect(result).toEqual(`${nextDay} at 11:59pm`);
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

test('expands times map Sat-Sun', () => {
  const times = new Map();
  times.set('Sat-Sun', '3:00pm');

  const result = index.expandTimesMap(times);

  expect(result.get('Saturday')[0]).toEqual(1500);
  expect(result.get('Saturday')[1]).toEqual('3:00pm');
  expect(result.get('Sunday')[0]).toEqual(1500);
  expect(result.get('Sunday')[1]).toEqual('3:00pm');
});

test('expands times map removes closed', () => {
  const times = new Map();
  times.set('Mon-Fri', 'Closed');
  times.set('Sat-Sun', 'Closed');
  times.set('Sat', 'Closed');
  times.set('Sun', 'Closed');

  const result = index.expandTimesMap(times);

  expect(result.size).toBe(0);
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
