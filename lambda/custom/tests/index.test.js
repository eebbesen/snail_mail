process.env.NODE_ENV = 'test';

const index = require('../index');

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
});