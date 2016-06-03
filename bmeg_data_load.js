/**
 * chrisw@soe.ucsc.edu
 * MAY 2016
 * bmeg_data_load.js is meant to load data from bmeg.io into data objects.
 * The incoming data should validate against the schema described in <https://github.com/bmeg/bmeg-schemas/blob/master/bmeg/gaea/schema/obs_deck.proto>
 */

var bmegDataLoader = bmegDataLoader || {};

(function(bdl) {"use strict";

    /**
     * Convenience method to a new eventObj to the eventAlbum.
     * @param {Object} OD_eventAlbum
     * @param {Object} feature
     * @param {Object} suffix
     * @param {Object} datatype
     * @param {Object} allowedValues
     * @param {Object} data
     */
    bdl.addEventBySampleData = function(OD_eventAlbum, feature, suffix, datatype, allowedValues, data) {

        var displayName = null;
        if (datatype === "drug sensitivity score") {
            var prefixRe = /^(.*?)\:/i;
            var suffixRe = /_(.*?)$/i;
            displayName = feature.replace(prefixRe, "").replace(suffixRe, "");
        } else {
            displayName = feature;
        }

        var eventObj = OD_eventAlbum.addEvent({
            'geneSuffix' : suffix,
            'id' : feature + suffix,
            'name' : datatype + ' for ' + feature,
            'displayName' : displayName,
            'description' : null,
            'datatype' : datatype,
            'allowedValues' : allowedValues
        }, data);
        return eventObj;
    };

    /**
     * Convenience method for adding sample data to the eventObj
     * @param {Object} eventObj
     * @param {Object} sampleData
     */
    bdl.addSampleData = function(eventObj, sampleData) {
        eventObj.data.setData(sampleData);
    };

    /**
     * Load event data retrieved from bmeg.io.
     * @param {Object} gaeaEventDataList
     * @param {Object} OD_eventAlbum
     */
    bdl.loadGaeaEventData = function(gaeaEventDataList, OD_eventAlbum) {
        _.each(gaeaEventDataList, function(gaeaEventData) {

            var gaeaEventMetadata = gaeaEventData["metadata"];
            var gaeaEventSampleData = gaeaEventData["sampleData"];

            var processedSampleData = {};
            _.each(gaeaEventSampleData, function(dataObj) {
                var sampleID = dataObj["sampleID"];
                var value = dataObj["value"];
                processedSampleData[sampleID] = value;
            });

            // get required metadata
            var eventId = gaeaEventMetadata["eventID"];
            var datatype = gaeaEventMetadata["eventType"];
            // var datatype = gaeaEventMetadata["datatype"];
            var allowedValues;
            var suffix;
            switch(datatype) {
                case "mrna_expression":
                    datatype = "expression data";
                    allowedValues = "numeric";
                    suffix = "_mRNA";
                    break;
                case "drug sensitivity score":
                    // scored classifier
                    allowedValues = "numeric";
                    // binary classifier
                    // allowedValues = "categoric";
                    suffix = "";
                    break;
                case "clinical":
                    datatype = "clinical data";
                    allowedValues = "categoric";
                    suffix = "";
                    break;
                default:
                    allowedValues = "categoric";
                    suffix = "";
            }

            var eventObj = OD_eventAlbum.getEvent(eventId);

            // add event if DNE
            if (eventObj == null) {
                bdl.addEventBySampleData(OD_eventAlbum, eventId, suffix, datatype, allowedValues, processedSampleData);
            } else {
                bdl.addSampleData(eventObj, processedSampleData);
            }

        });
        console.log("OD_eventAlbum", OD_eventAlbum);
    };

})(bmegDataLoader);
