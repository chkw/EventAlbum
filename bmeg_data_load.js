/**
 * chrisw@soe.ucsc.edu
 * MAY 2016
 * bmeg_data_load.js is meant to load data from bmeg.io into data objects.
 * The incoming data should validate against the schema described in <https://github.com/bmeg/bmeg-schemas/blob/master/bmeg/gaea/schema/obs_deck.proto>
 */

var bmegDataLoader = bmegDataLoader || {};

(function(bdl) {
    "use strict";

    bdl.displayNameGenerator = {
        "drug sensitivity score": function(name) {
            var prefixRe = /^(.*?)\:/i;
            var suffixRe = /_median$/i;
            var displayName = name.replace(prefixRe, "").replace(suffixRe, "");
            suffixRe = /(_[\d]+)+_mol_mol$/i;
            displayName = displayName.replace(suffixRe, "");
            return displayName;
        }
    };

    /**
     * Convenience method to a new eventObj to the eventAlbum.
     * @param {Object} OD_eventAlbum
     * @param {Object} feature
     * @param {Object} suffix
     * @param {Object} datatype
     * @param {Object} allowedValues
     * @param {Object} data
     */
    bdl.addEventBySampleData = function(OD_eventAlbum, feature, suffix,
        datatype, allowedValues, data) {

        var displayName = null;
        if (_.contains(_.keys(bdl.displayNameGenerator), datatype)) {
            displayName = bdl.displayNameGenerator[datatype](feature);
        } else {
            displayName = feature;
        }

        var eventObj = OD_eventAlbum.addEvent({
            'geneSuffix': suffix,
            'id': feature + suffix,
            'name': datatype + ' for ' + feature,
            'displayName': displayName,
            'description': null,
            'datatype': datatype,
            'allowedValues': allowedValues
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
        console.log("gaeaEventDataList.length", gaeaEventDataList.length);
        _.each(gaeaEventDataList, function(gaeaEventData) {

            var gaeaEventMetadata = gaeaEventData.metadata;
            var gaeaEventSampleData = gaeaEventData.sampleData;

            var processedSampleData = {};
            _.each(gaeaEventSampleData, function(dataObj) {
                var sampleID = dataObj.sampleID;
                var value = dataObj.value;
                if (_.isUndefined(value) || _.isNull(value) || value === "") {
                    value = "no value";
                }
                processedSampleData[sampleID] = value;
            });

            console.log("processedSampleData samples", _.keys(processedSampleData).length);

            // get required metadata
            var eventId = gaeaEventMetadata.eventID;
            var datatype = gaeaEventMetadata.eventType;
            // var datatype = gaeaEventMetadata["datatype"];
            var allowedValues;
            var suffix;
            console.log("eventId", eventId);
            console.log("datatype", datatype);
            switch (datatype) {
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
                case "mutation_call":
                    datatype = "mutation call";
                    allowedValues = "mutation type";
                    suffix = "_mutation";
                    break;
                default:
                    allowedValues = "categoric";
                    suffix = "";
            }

            var eventObj = OD_eventAlbum.getEvent(eventId);

            // add event if DNE
            if (_.isUndefined(eventObj) || _.isNull(eventObj)) {
                bdl.addEventBySampleData(OD_eventAlbum, eventId, suffix,
                    datatype, allowedValues, processedSampleData);
            } else {
                console.log("eventObj", eventObj);
                bdl.addSampleData(eventObj, processedSampleData);
            }

        });
        console.log("OD_eventAlbum", OD_eventAlbum);
    };

})(bmegDataLoader);
