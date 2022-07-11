exports.handler = function(context, event, callback) {

    //================================================================================
    // Modules
    //================================================================================

    var querystring = require('querystring');
    var request = require('request');

    //================================================================================
    // Context Variables
    //================================================================================

    // Are we using a sandbox or not
    var isSandbox = (context.SFUAT_IS_SANDBOX == 'true');

    //Consumer Key from Salesforce Connected app
    var clientId = context.SFUAT_CONSUMER_KEY;

    //Consumer Secrect from Salesforce Connected app
    var clientSecret = context.SFUAT_CONSUMER_SECRET;

    //The salesforce username;
    var sfUserName = context.SFUAT_USERNAME;

    //The salesforce password
    var sfPassword = context.SFUAT_PASSWORD;

    //The salesforce user token
    //var sfToken = context.SFUAT_TOKEN;

    //================================================================================
    // End Context Variables
    //================================================================================


    // Use namespace is to tell the code to apply the package namespace or not.
    // The default should be true.  If you are getting the requested resource
    // does not exist then try setting value to false.
    var useNameSpace = false;

    //The salesforce managed package namespace
    var nameSpace = 'TwilioSF__';

    //The login url
    var salesforceUrl = 'https://login.salesforce.com';

    if(isSandbox === true) {
        salesforceUrl = 'https://new-hampshire--gtdev.my.salesforce.com';
    }
    console.log(salesforceUrl);
    run();

    /**
     * Attempts to login with password
     * and then posts platform event
     */
     
    function run(){
        var form = {
            grant_type: 'password',
            client_id: clientId,
            client_secret: clientSecret,
            username: sfUserName,
            password:sfPassword//+sfToken
        };

        console.log('Username:'+ sfUserName + ' Pass' + sfPassword);

        var formData = querystring.stringify(form);
        var contentLength = formData.length;

        request({
            headers: {
                'Content-Length': contentLength,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            uri: salesforceUrl +'/services/oauth2/token',
            body: formData,
            method: 'POST'
        }, function (err, res, body) {
            if(res.statusCode == 200){
                console.log('Success Getting Token');
                var sfAuthReponse = JSON.parse(body);
                var platformEvent = buildPlatformEvent(event);
                postPlatformEvent(sfAuthReponse,platformEvent);
            } else{
                finishWithError('Error Getting Token:'+body);
            }
        });
    }

    /**
     * Posts Platform Event To Salesforce
     * @param sfAuthReponse
     * @param platformEvent
     */
    function postPlatformEvent(sfAuthReponse,platformEvent){

        console.log('Posting Platform Event:',platformEvent);

        var options = {
            uri: sfAuthReponse.instance_url + getPlatformEventUrl(),
            headers: {
                'Authorization': 'Bearer ' + sfAuthReponse.access_token,
            },
            body: platformEvent,
            json:true,
            method: 'POST'
        };

        request(options, processEventResponse);
    }

    /**
     * Processes Platform Event Response
     * @param error
     * @param response
     * @param body
     */
    function processEventResponse(error, response, body) {
        if (!error && response.statusCode == 201) {
            console.log('Success Posting Platform Event:  Server responded with:', body);
            finishSuccess();
        } else{
            console.error('Error Posting Platform Event:', body);
            finishWithError('Error Posting Platform Event:'+body);
        }

    }

    /**
     * Builds the platform event request
     * @param event
     */
    function buildPlatformEvent(event){
        //Object map that maps Twilio Field to Salesforce Field
        var eventToPEMap = {
            "Body":"Message__c",
            "From":"From__c",
            "To":"To__c"
        };

        var platformEvent = {};

        //Loop through event and build platform event
        for (var property in event) {
            if (eventToPEMap.hasOwnProperty(property)) {
                var eventProp;
                if(useNameSpace){
                    eventProp =  nameSpace + eventToPEMap[property];
                } else{
                    eventProp = eventToPEMap[property];
                }
                platformEvent[eventProp] = event[property];
            }
        }
        return platformEvent;
    }

    /**
     * Gets the Salesforce services url for the platform event
     * @returns {string}
     */
    function getPlatformEventUrl(){
        if(useNameSpace){
            return '/services/data/v43.0/sobjects/' + nameSpace + 'Twilio_Message_Status__e';
        } else{
            return '/services/data/v43.0/sobjects/Message__c';
        }
    }

    function finishSuccess(body){
        callback();
    }
    function finishWithError(body){
        callback(body);
    }
};
