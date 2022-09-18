Alexa skill to find the USPS collection boxes nearest you!

USPS collection boxes are the blue standalone mailboxes (well, sometimes they're slots in a wall or something) into which you can deposit mail to be picked up by a postal worker. Collection boxes have a consistent pickup times.

mail buddy will give you the distance and location of your closest collection boxes along with their pickup times.

# How it works
mail buddy uses an undocumented USPS endpoint that doesn't require [a Web Tools API key](https://www.usps.com/business/web-tools-apis/welcome.htm) like some of its other endpoints. This endpoint takes a URI-encoded street address (zip or street address & zip) and will provide distances to USPS collection boxes (the deep blue boxes you can put mail _into_) along with distance and pickup times. [This web interface](https://tools.usps.com/go/POLocatorAction.action) is where I found and reverse engineered the USPS API call -- it is where you can find the information provided by mail buddy in a web page format.

The underlying USPS endpoint is undocumented so use it at your own risk. It may cease to exist, the USPS may throttle or block your calls, etc.

## What are those green USPS boxes?
Great question! Those are postal relay boxes. They don't accept mail from the public but are used by mail carriers to store mail so they can have a lighter load during their route. The USPS has figured out how to maximize the value they get from these to save time and money (see [this article](https://mentalfloss.com/article/71244/what-are-those-dark-green-mailboxes-dont-accept-mail)).

These don't appear in the results that mail buddy creates.

# Development
This was build with NodeJS using the [Alexa Skills Kit Command Line Interface](https://developer.amazon.com/docs/smapi/ask-cli-intro.html).

The JavaScript code is located in lambda/custom, so you'll want to be in that directory when executing your Node commands.

## Prerequisites
### NodeJS
https://nodejs.org/en/docs/guides/

### npm
https://www.npmjs.com/get-npm

### Amazon Skills Kit Command Line Interface
https://www.npmjs.com/package/ask-cli

## Building
```bash
cd lambda/custom
npm install
```

## Deploying
```bash
ask deploy
```

## Testing
### JavaScript
This suite includes a test which hits the USPS enpoint and gets results, so be aware if you are offline, firewalled, or using a CI provider that doesn't like these sorts of external calls.

(Changing `test` to `test.skip` in your test files is a great way to skip any tests you don't want to run.)
```bash
cd lambda/custom
npm test
```

### Alexa
Simulate a call to an Alexa device. Note that your spoken phrase may not be as cleanly interpreted by Alexa as it is when you type it :).
```bash
ask simulate -t 'Alexa, open mail buddy' -l en-US
```

## cURL example
This calls the USPS API. I used it to understand what payload to expect.
```bash
curl 'https://tools.usps.com/UspsToolsRestServices/rest/POLocator/findLocations'  -H 'accept: application/json, text/javascript, */*; q=0.01' -H 'user-agent: Mozilla'  -H 'content-type: application/json;charset=UTF-8' -H 'referer: https://tools.usps.com/find-location.htm' -H 'accept-encoding: gzip, deflate, br' -H 'accept-language: en-US,en;q=0.9,de;q=0.8,el;q=0.7,ja;q=0.6,zh;q=0.5,de-DE;q=0.4'  --data-binary '{"maxDistance":"1","lbro":"","requestType":"collectionbox","requestServices":"","requestRefineTypes":"","requestRefineHours":"","requestCity":"st paul","requestState":"mn","requestAddressL1":"1600 grand ave"}' --compressed
```
should result in a dataset that contains `result` divs like this for each collection box:
```HTML
{
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
    },
  ],
  "extendedSearchPerformed": false,
  "entireRadiusListSearched": false,
  "lastRadiusSearched": "1"
}
```