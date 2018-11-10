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

(Changin `test` to `test.skip` in your test files is a great way to skip any tests you don't want to run.)
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
curl 'https://tools.usps.com/go/POLocatorAction.action' -H 'Content-Type: application/x-www-form-urlencoded' -H 'User-Agent: Mozilla' -H 'Accept: application/xhtml+xml' --data 'locationTypeQ=collectionbox&address=55104'
```
should result in a dataset that contains `result` divs like this for each collection box:
```HTML
<tr class="result" id="row49">
  <td class="hide" id="sort"><span class="sortValue">50</span></td>
  <td class="dist">
    <span id="locationTypeInList" class="hide">collectionbox</span>
    <span id="zoomLevel" class="hide"></span>
    <div class="flag" lat="44.96693" lon="-93.1822719">
      <span class="hide-fromsighted">Begin search result number 49</span>
      <img class="img img-55104-5510400038" src="/media/images/polo/collectionBox.png"
        alt="Blue flag marker designating the location of this Collection Box. Clicking this icon will scroll the map on the right of this page to make the location's equivalent marker visible inside the map. This may be helpful should you wish to print your selected location." />
    </div>
    <div class="miles">
      <span class="mile">1.2</span> mi
    </div>
  </td>
  <td class="location">
    <div class="link">
      <a id="po-details-link" href="/go/POLocatorDetailsAction!input.action?locationTypeQ=collectionbox&amp;address=55104&amp;radius=20&amp;locationType=collectionbox&amp;locationID=5510400038&amp;locationName=USPS+COLLECTION+BOX+-+BLUE+BOX&amp;address2=&amp;address1=860+PRIOR+AVE+N&amp;city=SAINT+PAUL&amp;state=MN&amp;zip5=55104&amp;zip4=&amp;tollFree=&amp;fax=&amp;latitude=44.96693&amp;longitude=-93.1822719&amp;sWithin=20&amp;&amp;&amp;&amp;&amp;&amp;&amp;&amp;&amp;" onclick=""><span class="po-name">USPS COLLECTION BOX - BLUE BOX</span>&nbsp;&#8250;</a>
    </div>
    <div class="address">
      <span class='addressLn' id='address'>860 PRIOR AVE N</span>
      <br />
      <span class='cityLn' id='city'>SAINT PAUL</span>, <span class='stateLn' id='state'>MN</span>
      <span class='zip-code' id='zipCode'>55104</span>
      <span class='zip-5 hide' id='zip5'>55104</span>
      <span class='zip-4 hide' id='zip4'></span><br />
      <span class='location-ID hide' id='locationID'>5510400038</span><br />
      <span class="phoneNum"></span><br /><br />
    </div>
  </td>
  <td class="hours" >
    <table class="hoursTable">
      <tbody>
        <tr>
          <td class="hoursTable_hours" style="padding-top:0; padding-bottom:12px;">
            <ul>
              <li>
                <span class="days">Mon-Sat</span>
                <span class="hours">1:00pm</span>
              </li>
              <li>
                <span class="days">Sun</span>
                <span class="hours">Closed</span>
              </li>
              <li>
                <div class="specialmsg">
                  On 12/24 and 12/31, this box may be collected as early as 12 noon.
                </div>
              </li>
            </ul>
          </td>
        </tr>
        <tr>
        </tr>
      </tbody>
    </table>
  </td>
</tr>
```