/**
 * chrisw@soe.ucsc.edu
 * 12AUG14
 * OD_eventData.js defines an event object that is to be used with Observation Deck.
 */

var eventData = eventData || {};
(function(ed) {"use strict";
    ed.OD_eventAlbum = function() {
        // ordinal score assignments to be saved in this object
        this.ordinalScoring = {
            "mutation impact" : {
                "MIN" : -1,
                "MODIFIER" : -0.3,
                "MODERATE" : 1,
                "HIGH" : 2
            }
        };

        /**
         * Specifies the tested sample IDs for a datatype.
         * Helps to distinguish from untested samples and "none found" data.
         */
        this.testedSamples = {};

        this.album = {};

        /**
         * map a datatype to its ID suffix
         */
        this.datatypeSuffixMapping = {};

        /**
         * keys:
         * event is the event that this pivot is scored on, could be something like expression, mutation, contrast, etc.
         * scores is a dictionary keying eventIds to a score
         *
         */
        this.pivot = {};

        this.setTestedSamples = function(datatype, testedSamples) {
            this.testedSamples[datatype] = testedSamples;
            console.log("testedSamples", this.testedSamples);
        };

        this.getTestedSamples = function(datatype) {
            return (this.testedSamples[datatype]);
        };

        this.getSuffixedEventId = function(name, datatype) {
            var suffix = ( datatype in this.datatypeSuffixMapping) ? this.datatypeSuffixMapping[datatype] : "";
            return name + suffix;
        };

        this.addEvent = function(metadataObj, data) {
            var newEvent = new ed.OD_event(metadataObj);
            this.album[metadataObj['id']] = newEvent;

            if (("datatype" in metadataObj) && ("geneSuffix" in metadataObj)) {
                this.datatypeSuffixMapping[metadataObj["datatype"]] = metadataObj["geneSuffix"];
            }

            // add data
            var isNumeric = ((metadataObj['allowedValues'] == 'numeric') || metadataObj['allowedValues'] == 'expression');
            newEvent.data.setData(data, isNumeric);

            // return this;
            return newEvent;
        };

        this.deleteEvent = function(eventId) {
            delete this.album[eventId];
        };

        /**
         * Get all of the eventIds in the album.
         */
        this.getAllEventIds = function() {
            var result = [];
            var groupedEvents = this.getEventIdsByType();
            for (var group in groupedEvents) {
                var events = groupedEvents[group];
                result = result.concat(events);
            }
            return result;
        };

        /**
         * Get the eventIds grouped by datatype.
         */
        this.getEventIdsByType = function() {
            var groupedEventIds = {};
            var eventIdList = utils.getKeys(this.album);
            for (var i = 0; i < eventIdList.length; i++) {
                var eventId = eventIdList[i];
                var datatype = this.getEvent(eventId).metadata.datatype;
                if (!utils.hasOwnProperty(groupedEventIds, datatype)) {
                    groupedEventIds[datatype] = [];
                }
                groupedEventIds[datatype].push(eventId);
            }
            return groupedEventIds;
        };

        /**
         * Get all of the event data for specified samples.
         */
        this.getEventData = function(sampleIds) {
            var result = {};
            // iter over eventIds
            var eventIdList = utils.getKeys(this.album);
            for (var i = 0; i < eventIdList.length; i++) {
                var eventId = eventIdList[i];
                var eventData = this.getEvent(eventId).data;
                // grab data for sample IDs
                var data = eventData.getData(sampleIds);
                result[eventId] = data;
            }
            return result;
        };

        /**
         * Get all of the event data in a list of objects.  Each object has keys: eventId, id, val.
         */
        this.getAllDataAsList = function() {
            var allDataList = [];
            var allDataObj = this.getEventData();
            var eventNameList = utils.getKeys(allDataObj);
            for (var i = 0; i < eventNameList.length; i++) {
                var eventName = eventNameList[i];
                var eventData = allDataObj[eventName].slice();
                for (var j = 0; j < eventData.length; j++) {
                    eventData[j]['eventId'] = eventName;
                }
                allDataList = allDataList.concat(eventData);
            }
            return allDataList;
        };

        /**
         * Get all of the sample IDs in album.
         */
        this.getAllSampleIds = function() {
            var sampleIds = [];
            var eventIdList = utils.getKeys(this.album);
            for (var i = 0; i < eventIdList.length; i++) {
                var eventId = eventIdList[i];
                var eventSampleIds = this.getEvent(eventId).data.getAllSampleIds();
                sampleIds = sampleIds.concat(eventSampleIds);
            }
            return utils.eliminateDuplicates(sampleIds);
        };

        /**
         * Select samples that meet the criteria.
         */
        this.selectSamples = function(selectionCriteria) {
            var ids = this.getAllSampleIds();
            if (selectionCriteria.length == 0) {
                return ids;
            }
            for (var i in selectionCriteria) {
                var eventId = selectionCriteria[i]["eventId"];
                var value = selectionCriteria[i]["value"];

                // select IDs from event data
                ids = this.getEvent(eventId).data.selectIds(value, ids);
            }
            return ids;
        };
        /**
         * Get the specified event from the album.
         */
        this.getEvent = function(eventId) {
            var e = this.album[eventId];
            if ( typeof e === "undefined") {
                console.log("getEvent got undefined eventObj for: " + eventId);
            }
            return e;
        };

        /**
         * recursive function to get all children IDs.
         */
        this.getAllChildren = function(idList, inputChildrenList) {
            var childList = ( typeof inputChildrenList === "undefined") ? [] : inputChildrenList;

            // collect children
            var currentChildren = [];
            for (var i = 0; i < idList.length; i++) {
                var id = idList[i];
                var currentMetadata = this.getEvent(id).metadata;
                currentChildren = currentChildren.concat(getKeys(currentMetadata.children));
            }

            // recurse on children
            if (currentChildren.length == 0) {
                return childList;
            } else {
                var newChildList = childList.concat(currentChildren);
                return this.getAllChildren(currentChildren, newChildList);
            }
        };

        /**
         * pivotScores is a dictionary keying eventIds to some score.
         *
         */
        this.setPivotScores_dict = function(pivotEvent, pivotScoresDict) {
            // TODO currently loaded in as an array of {gene,weight} objects
            if (pivotScoresDict == null) {
                this.pivot = {};
            } else {
                this.pivot = {
                    'event' : pivotEvent,
                    'scores' : pivotScoresDict
                };

            }
            console.log("pivot dict", this.pivot);
            return this;
        };

        /**
         * pivotScores is array of {eventId1,eventId2,score}.
         *
         */
        this.setPivotScores_array = function(pivotEvent, pivotScores) {
            if (pivotScores == null) {
                this.pivot = {};
            } else {
                pivotScores = pivotScores.sort(utils.sort_by('score'));
                this.pivot = {
                    'event' : pivotEvent,
                    'scores' : pivotScores
                };
            }
            console.log("pivot array", this.pivot);
            return this;
        };

        /**
         * Get a sorted list of events by pivot score.  Returns a list of objects with keys: "key" and "val".
         */
        this.getPivotSortedEvents = function(pEventId) {
            if (( typeof this.pivot.scores === 'undefined') || (this.pivot.scores == null)) {
                console.log('getPivotSortedEvents found no pivot scores');
                return [];
            }
            var sortedEvents = [];
            var recordedEvents = {};
            _.each(this.pivot.scores, function(scoreObj) {
                var eventId1 = scoreObj['eventId1'];
                var eventId2 = scoreObj['eventId2'];
                var score = scoreObj['score'];

                var key;
                var val = score;
                console.log("pEventId", pEventId);
                pEventId = pEventId.replace(/_mRNA$/, "");
                pEventId = pEventId.replace(/_mutation$/, "");
                if (eventId1 === pEventId) {
                    key = eventId2;
                } else if (eventId2 === pEventId) {
                    key = eventId1;
                } else {
                    // filter by pEventId
                    return;
                }

                if (utils.hasOwnProperty(recordedEvents, key)) {
                    // duplicate event
                    return;
                }

                sortedEvents.push({
                    "key" : key,
                    "val" : parseFloat(val)
                });

                recordedEvents[key] = 1;
            });
            sortedEvents = sortedEvents.sort(utils.sort_by('val'));
            return sortedEvents;
        };

        /**
         * Get pivot sorted events organized by datatype.
         */
        this.getGroupedPivotSorts = function(pEventId) {
            console.log('getGroupedPivotSorts');
            var result = {};

            // Extract the gene symbols. They are without suffix.
            pEventId = pEventId.replace(/_mRNA$/, "");
            var pivotSortedEventObjs = this.getPivotSortedEvents(pEventId);

            var pivotSortedEvents = [];
            _.each(pivotSortedEventObjs, function(pivotSortedEventObj) {
                pivotSortedEvents.push(pivotSortedEventObj['key']);
            });

            // iterate through datatypes
            var groupedEvents = this.getEventIdsByType();
            var orderedDatatypes = getOrderedDatatypes(_.keys(groupedEvents));

            // preferred order of submatrices
            _.each(orderedDatatypes, function(datatype) {
                var orderedEvents = [];

                // suffixed ids here
                var unorderedEvents = groupedEvents[datatype];

                // no pivot sorted events available
                if (pivotSortedEvents.length == 0) {
                    console.log('pivotSortedEvents.length == 0 for ' + datatype);
                    result[datatype] = unorderedEvents;
                    return;
                }

                // add scored events in the datatype
                _.each(pivotSortedEvents, function(eventId) {
                    var eventId = this.getSuffixedEventId(eventId, datatype);
                    if (utils.isObjInArray(unorderedEvents, eventId)) {
                        orderedEvents.push(eventId);
                    }
                }, this);

                // add the unscored events from the datatype group
                orderedEvents = orderedEvents.concat(unorderedEvents);
                orderedEvents = utils.eliminateDuplicates(orderedEvents);

                result[datatype] = orderedEvents;
            }, this);

            return result;
        };

        /**
         * Get all pivot scores for each pivot in a datatype.
         */
        this.getAllPivotScores = function(datatype, scoringAlgorithm) {
            var allPivotScores = {};

            var groupedEvents = this.getEventIdsByType();
            if (! utils.hasOwnProperty(groupedEvents, datatype)) {
                return allPivotScores;
            }

            var events = groupedEvents[datatype];
            for (var i = 0; i < events.length; i++) {
                var pivotEvent = events[i];
                var scores = this.pivotSort(pivotEvent, scoringAlgorithm);
                allPivotScores[pivotEvent] = scores;
            }

            return allPivotScores;
        };

        /**
         * Place the datatypes into a preferred ordering for viz
         */
        var getOrderedDatatypes = function(datatypes) {
            var preferredOrdering = ["clinical data", "expression data", "mutation call", "mutation impact score", "gistic_copy_number", "kinase target activity", "tf target activity", "expression signature", "mvl drug sensitivity", "datatype label"];

            // expected datatypes
            var list1 = _.filter(preferredOrdering, function(datatype) {
                return _.contains(datatypes, datatype);
            });

            // unexpected datatypes
            var list2 = _.reject(datatypes, function(datatype) {
                return _.contains(preferredOrdering, datatype);
            });

            var orderedDatatypes = list1.concat(list2);
            return orderedDatatypes;
        };

        /**
         * multi-sorting of events
         */
        this.multisortEvents = function(rowSortSteps, colSortSteps) {
            console.log('multisortEvents');
            console.log('rowSortSteps', rowSortSteps);
            console.log('colSortSteps', colSortSteps);
            // default ordering
            var groupedEvents = this.getEventIdsByType();
            console.log("groupedEvents", groupedEvents);

            var orderedDatatypes = getOrderedDatatypes(_.keys(groupedEvents));

            var eventList = [];
            _.each(orderedDatatypes, function(datatype) {
                if (datatype === 'datatype label') {
                    return;
                }
                // add datatype row labels to datatype event lists
                var datatypeEventList = groupedEvents[datatype];
                datatypeEventList.unshift(datatype + "(+)");
                datatypeEventList.push(datatype + "(-)");
                eventList = eventList.concat(datatypeEventList);
            });

            // bubble up colSort events
            var bubbledUpEvents = [];
            if (colSortSteps != null) {
                // bring sorting rows up to top
                var steps = colSortSteps.getSteps();
                for (var b = 0; b < steps.length; b++) {
                    var step = steps[b];
                    var eventId = step['name'];
                    bubbledUpEvents.push(eventId);
                }
                bubbledUpEvents.reverse();
            }
            var rowNames = bubbledUpEvents.slice(0);

            // fill in rest of the list
            rowNames = rowNames.concat(eventList);
            rowNames = utils.eliminateDuplicates(rowNames);

            if (rowSortSteps != null) {
                var steps = rowSortSteps.getSteps().reverse();
                for (var b = 0; b < steps.length; b++) {
                    var step = steps[b];
                    var eventId = step['name'];
                    var reverse = step['reverse'];
                    var eventObj = this.getEvent(eventId);
                    var datatype = eventObj.metadata.datatype;
                    var scoredDatatype = eventObj.metadata.scoredDatatype;

                    // var datatypeSuffix = this.datatypeSuffixMapping[scoredDatatype];

                    if (scoredDatatype == null) {
                        console.log("no scored datatype to sort");
                        continue;
                    }

                    var orderedGeneList = eventObj.metadata.sortSignatureVector();
                    if (reverse) {
                        orderedGeneList.reverse();
                    }

                    var eventGroupEventIds;
                    if (utils.hasOwnProperty(groupedEvents, scoredDatatype)) {
                        eventGroupEventIds = groupedEvents[scoredDatatype].slice(0);
                    } else {
                        console.log(scoredDatatype + " group has no events");
                        continue;
                    }

                    var processedExpressionEventList = [];
                    var scoredEventSigWeightOverlap = [];
                    for (var c = 0; c < orderedGeneList.length; c++) {
                        var orderedGene = orderedGeneList[c];
                        // var orderedGene_eventId = orderedGene + datatypeSuffix;
                        var orderedGene_eventId = this.getSuffixedEventId(orderedGene, scoredDatatype);
                        var index = eventGroupEventIds.indexOf(orderedGene_eventId);
                        if (index >= 0) {
                            // events that are in signature weight vector AND datatype group
                            scoredEventSigWeightOverlap.push(orderedGene_eventId);
                        }
                        if ((index >= 0) && (!utils.isObjInArray(bubbledUpEvents, orderedGene_eventId))) {
                            // only add scored events that have records in the event album
                            processedExpressionEventList.push(orderedGene_eventId);
                            delete eventGroupEventIds[index];
                        }

                        if (utils.isObjInArray(bubbledUpEvents, orderedGene_eventId)) {
                            // skip bubbled up scored events
                            delete eventGroupEventIds[index];
                        }
                    }
                    console.log("scoredEventSigWeightOverlap", (scoredEventSigWeightOverlap.length), scoredEventSigWeightOverlap);

                    // add events that did not appear in signature
                    for (var d in eventGroupEventIds) {
                        processedExpressionEventList.push(eventGroupEventIds[d]);
                    }

                    // assemble all datatypes together
                    var eventList = bubbledUpEvents.slice(0);

                    _.each(orderedDatatypes, function(datatype) {
                        if (datatype === scoredDatatype) {
                            eventList = eventList.concat(processedExpressionEventList);
                        } else {
                            var datatypeEventList = groupedEvents[datatype];
                            for (var i in datatypeEventList) {
                                var eventId = datatypeEventList[i];
                                if (utils.isObjInArray(eventList, eventId)) {
                                    // skip
                                } else {
                                    eventList.push(eventId);
                                }
                            }
                        }
                    });

                    rowNames = eventList;
                    console.log('rowNames.length', rowNames.length, rowNames);

                    // only do this for the first step
                    break;
                }
            }

            return rowNames;
        };

        /**
         * If sortingSteps is null, then just return the sampleIds without sorting.
         */
        this.multisortSamples = function(sortingSteps) {
            var sampleIds = this.getAllSampleIds();
            if (sortingSteps == null) {
                console.log("multisortSamples got null steps");
                return sampleIds;
            }
            console.log("multisortSamples using steps:", sortingSteps.getSteps());
            var steps = sortingSteps.getSteps().slice();
            steps.reverse();

            var album = this;

            sampleIds.sort(function(a, b) {
                // begin sort function
                var comparisonResult = 0;
                // iterate over sorting steps in order
                for (var i = 0; i < steps.length; i++) {
                    // get this step's values
                    var eventId = steps[i]['name'];
                    if ( typeof eventId === "undefined") {
                        continue;
                    }
                    var reverse = steps[i]['reverse'];
                    var eventObj = album.getEvent(eventId);
                    if ((eventObj == undefined) || (eventObj == null)) {
                        for (var key in album.datatypeSuffixMapping) {
                            var newId = eventId + album.datatypeSuffixMapping[key];
                            eventObj = album.getEvent(newId);
                            if ((eventObj != undefined) && (eventObj != null)) {
                                // console.log("use " + newId + " for " + eventId);
                                eventId = newId;
                                break;
                            }
                        }
                        if ((eventObj == undefined) || (eventObj == null)) {
                            console.log('no event found for sorting: ' + eventId);
                            continue;
                        }
                    }
                    var allowedValues = eventObj.metadata['allowedValues'];

                    var vals = eventObj.data.getData([a, b]);
                    var valA = vals[0]['val'];
                    var valB = vals[1]['val'];

                    // select correct comparator
                    var comparator = null;
                    if (allowedValues == 'numeric') {
                        comparator = utils.compareAsNumeric;
                    } else if (allowedValues == 'categoric') {
                        comparator = utils.compareAsString_medbook;
                    } else if (allowedValues == 'expression') {
                        comparator = utils.compareAsNumeric;
                    } else if (allowedValues == 'date') {
                        comparator = utils.compareAsDate;
                    } else {
                        comparator = utils.compareAsString_medbook;
                    }

                    // compare this step's values
                    comparisonResult = comparator(valA, valB);

                    // numeric events sort large to small by default
                    if (comparator == utils.compareAsNumeric) {
                        comparisonResult = comparisonResult * -1;
                    }

                    if (reverse) {
                        comparisonResult = comparisonResult * -1;
                    }

                    // return final comparison or try next eventId
                    if (comparisonResult == 0) {
                        continue;
                    } else {
                        break;
                    }

                }
                return comparisonResult;
                // end sort function
            });

            return sampleIds;
        };

        /**
         * rescale by z-score over each eventId
         */
        this.zScoreExpressionRescaling = function() {
            console.log('zScoreExpressionRescaling');

            // get expression events
            var allEventIds = this.getEventIdsByType();
            if (!utils.hasOwnProperty(allEventIds, 'expression data')) {
                console.log('no expression');
                return null;
            }
            var expressionEventIds = allEventIds['expression data'];

            // compute average expression each gene
            var stats = {};
            var result = {
                'stats' : stats
            };

            var allAdjustedVals = [];

            for (var i = 0; i < expressionEventIds.length; i++) {
                var eventId = expressionEventIds[i];

                // get mean and sd
                var eventStats = this.getEvent(eventId).data.getStats();
                stats[eventId] = {};
                stats[eventId] = eventStats;

                // finally iter over all samples to adjust score
                var allEventData = this.getEvent(eventId).data.getData();
                for (var k = 0; k < allEventData.length; k++) {
                    var data = allEventData[k];
                    if (utils.hasOwnProperty(data, 'val_orig')) {
                        data['val'] = data['val_orig'];
                    }
                    var val = data['val'];
                    data['val_orig'] = val;
                    if (utils.isNumerical(val)) {
                        var z = (val - stats[eventId]['mean']) / (stats[eventId]['sd']);
                        data['val'] = z;
                        allAdjustedVals.push(data['val']);
                    }
                }
            }

            // find min/max of entire expression matrix
            result['maxVal'] = jStat.max(allAdjustedVals);
            result['minVal'] = jStat.min(allAdjustedVals);

            return result;
        };

        /**
         *  Rescale expression data.

         */
        this.betweenMeansExpressionRescaling = function(clinicalEventId, category1, category2) {
            console.log('betweenMeansExpressionRescaling', clinicalEventId, category1, category2);
            // get group sample IDs
            var group1SampleIds = this.getEvent(clinicalEventId).data.selectIds(category1);

            var group2SampleIds = null;
            if (category2 == null) {
                group2SampleIds = this.getEvent(clinicalEventId).data.selectIds(category2);
                group2SampleIds = group2SampleIds.concat(group1SampleIds);
                group2SampleIds = utils.eliminateDuplicates(group2SampleIds);
            } else {
                group2SampleIds = this.getEvent(clinicalEventId).data.selectIds(category2);
            }

            // get expression events
            var allEventIds = this.getEventIdsByType();
            if (!utils.hasOwnProperty(allEventIds, 'expression data')) {
                console.log('no expression');
                return null;
            }
            var expressionEventIds = allEventIds['expression data'];

            // compute average expression of groups over each gene
            var meanVals = {};
            var result = {
                'meanVals' : meanVals
            };

            var allAdjustedVals = [];

            for (var i = 0; i < expressionEventIds.length; i++) {
                var eventId = expressionEventIds[i];
                meanVals[eventId] = {};
                meanVals[eventId]['group1'] = this.getEvent(eventId).data.getStats(group1SampleIds)['mean'];
                meanVals[eventId]['group2'] = this.getEvent(eventId).data.getStats(group2SampleIds)['mean'];

                // finally iter over all samples to adjust score
                var adjustment = (meanVals[eventId]['group2'] - meanVals[eventId]['group1']) / 2;
                var allEventData = this.getEvent(eventId).data.getData();
                for (var k = 0; k < allEventData.length; k++) {
                    var data = allEventData[k];
                    if (utils.hasOwnProperty(data, 'val_orig')) {
                        data['val'] = data['val_orig'];
                    }
                    var val = data['val'];
                    data['val_orig'] = val;
                    if (utils.isNumerical(val)) {
                        data['val'] = val - adjustment;
                        allAdjustedVals.push(data['val']);
                    }
                }
            }

            // find min/max of entire expression matrix
            result['maxVal'] = jStat.max(allAdjustedVals);
            result['minVal'] = jStat.min(allAdjustedVals);

            return result;
        };

        /**
         * Rescale all expression data by subtracting mean of specified group on a per-event basis.  Returns new min/max values.
         */
        this.yuliaExpressionRescaling = function(clinicalEventId, category) {
            console.log('yuliaExpressionRescaling', clinicalEventId, category);
            // get sampleId list of neg group
            var negSampleIds = this.getEvent(clinicalEventId).data.selectIds(category);

            // get expression events
            var allEventIds = this.getEventIdsByType();
            if (!utils.hasOwnProperty(allEventIds, 'expression data')) {
                console.log('no expression');
                return null;
            }
            var expressionEventIds = allEventIds['expression data'];

            // compute average expression of neg group over each gene
            var meanVals = {};
            var result = {
                'meanVals' : meanVals
            };

            var allAdjustedVals = [];

            for (var i = 0; i < expressionEventIds.length; i++) {
                var eventId = expressionEventIds[i];
                meanVals[eventId] = this.getEvent(eventId).data.getStats(negSampleIds)['mean'];

                // second iter over all samples to adjust score
                var allEventData = this.getEvent(eventId).data.getData();
                for (var j = 0; j < allEventData.length; j++) {
                    var data = allEventData[j];
                    if (utils.hasOwnProperty(data, 'val_orig')) {
                        data['val'] = data['val_orig'];
                    }
                    var val = data['val'];
                    data['val_orig'] = val;
                    if (utils.isNumerical(val)) {
                        data['val'] = val - meanVals[eventId];
                        allAdjustedVals.push(data['val']);
                    }
                }
            }

            // find min/max of entire expression matrix
            result['maxVal'] = jStat.max(allAdjustedVals);
            result['minVal'] = jStat.min(allAdjustedVals);

            return result;
        };

        /**
         * for checking if some samples have differential expression
         */
        this.eventwiseMedianRescaling_old = function() {
            console.log('eventwiseMedianRescaling');

            // get expression events
            var allEventIds = this.getEventIdsByType();
            if (!utils.hasOwnProperty(allEventIds, 'expression data')) {
                console.log('no expression');
                return null;
            }
            var expressionEventIds = allEventIds['expression data'];

            // compute average expression each gene
            var stats = {};
            var result = {
                'stats' : stats
            };

            var allAdjustedVals = [];

            for (var i = 0; i < expressionEventIds.length; i++) {
                var eventId = expressionEventIds[i];

                // get stats
                var eventObj = this.getEvent(eventId);
                var eventStats = this.getEvent(eventId).data.getStats();
                stats[eventId] = {};
                stats[eventId] = eventStats;

                // finally iter over all samples to adjust score
                var allEventData = this.getEvent(eventId).data.getData();
                for (var k = 0; k < allEventData.length; k++) {
                    var data = allEventData[k];
                    if (utils.hasOwnProperty(data, 'val_orig')) {
                        data['val'] = data['val_orig'];
                    }
                    var val = data['val'];
                    data['val_orig'] = val;
                    if (utils.isNumerical(val)) {
                        var newVal = (val - stats[eventId]['median']);
                        data['val'] = newVal;
                        allAdjustedVals.push(data['val']);
                    }
                }
            }

            // find min/max of entire expression matrix
            result['maxVal'] = jStat.max(allAdjustedVals);
            result['minVal'] = jStat.min(allAdjustedVals);

            return result;
        };

        this.eventwiseMedianRescaling_events = function(eventIds) {
            // compute average val each gene
            var stats = {};
            var result = {
                'stats' : stats
            };

            var allAdjustedVals = [];

            _.each(eventIds, function(eventId) {
                // get stats
                var eventObj = this.getEvent(eventId);
                var eventStats = this.getEvent(eventId).data.getStats();
                stats[eventId] = {};
                stats[eventId] = eventStats;

                // finally iter over all samples to adjust score
                var allEventData = this.getEvent(eventId).data.getData();

                _.each(allEventData, function(data) {
                    if (utils.hasOwnProperty(data, 'val_orig')) {
                        data['val'] = data['val_orig'];
                    }
                    var val = data['val'];
                    data['val_orig'] = val;
                    if (utils.isNumerical(val)) {
                        var newVal = (val - stats[eventId]['median']);
                        data['val'] = newVal;
                        allAdjustedVals.push(data['val']);
                    }
                });
            }, this);

            // find min/max of entire matrix
            result['maxVal'] = jStat.max(allAdjustedVals);
            result['minVal'] = jStat.min(allAdjustedVals);

            return result;
        };

        /**
         * for checking if some samples have differential expression
         */
        this.eventwiseMedianRescaling = function(datatypesToRescale) {
            console.log('eventwiseMedianRescaling');
            // get expression events
            var allEventIds = this.getEventIdsByType();
            var datatypesToRescale = datatypesToRescale || _.keys(allEventIds);
            var result = {};
            _.each(datatypesToRescale, function(eventType) {
                console.log("eventType", eventType);
                var eventIds = allEventIds[eventType];
                if (this.getEvent(eventIds[0]).metadata.allowedValues === "numeric") {
                    var datatypeResult = this.eventwiseMedianRescaling_events(eventIds);
                    result[eventType] = datatypeResult;
                }
            }, this);
            return result["expression data"];
        };

        /**
         * for checking general expression level of gene
         */
        this.samplewiseMedianRescaling = function() {
            // TODO
            console.log('samplewiseMedianRescaling');

            // get expression events
            var allEventIds = this.getEventIdsByType();
            if (!utils.hasOwnProperty(allEventIds, 'expression data')) {
                console.log('no expression');
                return null;
            }
            var expressionEventIds = allEventIds['expression data'];

            // compute average expression each sample
            var stats = {};
            var result = {
                'stats' : stats
            };

            var allAdjustedVals = [];

            var samples = this.getAllSampleIds();
            for (var i = 0; i < samples.length; i++) {
                var sample = samples[i];
                stats[sample] = {};
                // console.log(sample);
                var sampleEventData = this.getEventData([sample]);
                // console.log(prettyJson(sampleEventData));
                // compute median over expression events
                var sampleVals = [];
                for (var j = 0; j < expressionEventIds.length; j++) {
                    var eventId = expressionEventIds[j];
                    if (utils.hasOwnProperty(sampleEventData, eventId)) {
                        var eventData = sampleEventData[eventId][0];
                        if (eventData['id'] === sample) {
                            if (utils.hasOwnProperty(eventData, 'val_orig')) {
                                eventData['val'] = eventData['val_orig'];
                            }
                            var val = eventData['val'];
                            eventData['val_orig'] = val;
                            if (utils.isNumerical(val)) {
                                sampleVals.push(val);
                                // console.log(sample + "->" + eventId + "->" + val);
                            }
                        }
                    } else {
                        console.log(eventId + ' was not found for ' + sample);
                        continue;
                    }
                }
                // console.log('sampleVals.length for ' + sample + ': ' + sampleVals.length);
                var sampleMed = jStat.median(sampleVals);
                // console.log('expression median for ' + sample + ': ' + sampleMed);
                stats[sample]['samplewise median'] = sampleMed;

                if (isNaN(sampleMed)) {
                    console.log('sample median for ' + sample + ' is NaN.');
                    continue;
                }

                // rescale values over expression events
                for (var j = 0; j < expressionEventIds.length; j++) {
                    var eventId = expressionEventIds[j];
                    if (utils.hasOwnProperty(sampleEventData, eventId)) {
                        var eventData = sampleEventData[eventId][0];
                        if (eventData['id'] === sample) {
                            if (utils.hasOwnProperty(eventData, 'val_orig')) {
                                eventData['val'] = eventData['val_orig'];
                            }
                            var val = eventData['val'];
                            eventData['val_orig'] = val;
                            if (utils.isNumerical(val)) {
                                var newVal = val - stats[sample]['samplewise median'];
                                eventData['val'] = newVal;
                                allAdjustedVals.push(val);
                            }
                        }
                    } else {
                        console.log(eventId + ' was not found for ' + sample);
                        continue;
                    }
                }
            }

            // find min/max of entire expression matrix
            result['maxVal'] = jStat.max(allAdjustedVals);
            result['minVal'] = jStat.min(allAdjustedVals);

            return result;
        };

        /**
         * for checking if a differential expression is in an expressed gene or not
         */
        this.bivariateNormalization = function() {
            // TODO

        };

        /**
         * remove events that have no sample data
         */
        this.removeEmptyEvents = function(maxPercentNull) {
            var threshold = maxPercentNull || 0.99;
            var allEventIdsByCategory = this.getEventIdsByType();
            var emptyEvents = [];
            var categories = utils.getKeys(allEventIdsByCategory);
            for (var i = 0, length = categories.length; i < length; i++) {
                var category = categories[i];
                if (category === "datatype label") {
                    continue;
                }
                for (var j = 0; j < allEventIdsByCategory[category].length; j++) {
                    var eventId = allEventIdsByCategory[category][j];
                    var eventObj = this.getEvent(eventId);
                    var percentNull = eventObj.data.getPercentNullData();
                    if (percentNull >= threshold) {
                        emptyEvents.push(eventId);
                    }
                }
            }
            for (var i = 0, length = emptyEvents.length; i < length; i++) {
                var eventId = emptyEvents[i];
                console.log("empty event:", eventId);
                this.deleteEvent(eventId);
            }
            return null;
        };

        /**
         * Fill in missing samples data with the specified value.
         */
        this.fillInMissingSamples = function(value) {
            // get all sample IDs
            var allAlbumSampleIds = this.getAllSampleIds();

            // get all sample IDs for event
            var allEventIdsByCategory = this.getEventIdsByType();
            _.each(_.keys(allEventIdsByCategory), function(category) {
                _.each(allEventIdsByCategory[category], function(eventId) {
                    var eventData = this.getEvent(eventId).data;
                    var allEventSampleIds = eventData.getAllSampleIds();
                    if (allAlbumSampleIds.length - allEventSampleIds.length == 0) {
                        return;
                    };

                    // find missing data
                    var missingSampleIds = utils.keepReplicates(allAlbumSampleIds.concat(allEventSampleIds), 2, true);
                    var missingData = {};
                    _.each(missingSampleIds, function(id) {
                        if (eventId === "patientSamples") {
                            missingData[id] = "other patient";
                        } else if (true && category === "mutation call") {
                            // set to no call for tested samples without mutation call
                            var isTested = _.contains(this.getTestedSamples(category), id);
                            if (isTested) {
                                missingData[id] = ["no call"];
                            } else {
                                missingData[id] = value;
                            }
                            console.log(isTested, eventId, category, id, missingData[id]);
                        } else {
                            missingData[id] = value;
                        }
                    }, this);
                    // add data
                    this.getEvent(eventId).data.setData(missingData);
                }, this);
            }, this);
            return this;
        };

        /**
         * NOTE!!! ALL missing sample data will be filled in!
         */
        this.fillInDatatypeLabelEvents = function(value) {
            var allEventIdsByCategory = this.getEventIdsByType();
            var datatypes = utils.getKeys(allEventIdsByCategory);

            var datatypeLabelDatatype = "datatype label";

            _.each(datatypes, function(datatype) {
                if (datatype === datatypeLabelDatatype) {
                    return;
                }

                var pos_suffix = "(+)";
                var neg_suffix = "(-)";

                var eventObj = this.addEvent({
                    'id' : datatype + pos_suffix,
                    'name' : datatype + pos_suffix,
                    'displayName' : datatype + pos_suffix,
                    'description' : null,
                    'datatype' : datatypeLabelDatatype,
                    'allowedValues' : null
                }, {});

                var eventObj_anti = this.addEvent({
                    'id' : datatype + neg_suffix,
                    'name' : datatype + neg_suffix,
                    'displayName' : datatype + neg_suffix,
                    'description' : null,
                    'datatype' : datatypeLabelDatatype,
                    'allowedValues' : null
                }, {});
            }, this);

            this.fillInMissingSamples(value);
        };

        this.getDatatypeNullSamples = function(datatype) {
            var samplesToHide = [];
            try {
                // get eventobjs in datatype
                var eventIdsByType = this.getEventIdsByType();
                var eventTypes = utils.getKeys(eventIdsByType);
                if (utils.isObjInArray(eventTypes, datatype)) {
                    // find samples that are null in all events of the datatype
                    samplesToHide = this.getAllSampleIds();
                    var eventIds = eventIdsByType[datatype];
                    for (var i = 0, length = eventIds.length; i < length; i++) {
                        var eventId = eventIds[i];
                        var eventObj = this.getEvent(eventId);
                        var nullSamples = eventObj.data.getNullSamples();
                        samplesToHide = samplesToHide.concat(nullSamples);
                        samplesToHide = utils.keepReplicates(samplesToHide);
                    }
                }
            } catch (error) {
                console.log('ERROR while getting samples to hide in datatype:', datatype, 'error.message ->', error.message);
            } finally {
                console.log('samplesToHide', samplesToHide);
                return samplesToHide;
            }
        };

        /**
         * Get min/max etc for datatypes.
         */
        this.getDatatypeStats = function() {
            // TODO getDatatypeStats
            var groupedStats = {};

            var groupedEvents = this.getEventIdsByType();

            _.each(groupedEvents, function(events, datatype) {
                var datatypeStats = {
                    "min" : null,
                    "max" : null
                };
                _.each(events, function(eventId, index) {
                    var eventObj = this.getEvent(eventId);
                    var stats = eventObj.data.getStats();

                    //  update datatypeStats
                    stats["min"] = Number(stats["min"]);
                    if (_.isNumber(stats["min"])) {
                        if (_.isNull(datatypeStats["min"])) {
                            datatypeStats["min"] = stats["min"];
                        }
                        if (stats["min"] < datatypeStats["min"]) {
                            datatypeStats["min"] = stats["min"];
                        }
                    }

                    stats["max"] = Number(stats["max"]);
                    if (_.isNumber(stats["max"])) {
                        if (_.isNull(datatypeStats["max"])) {
                            datatypeStats["max"] = stats["max"];
                        }
                        if (stats["max"] > datatypeStats["max"]) {
                            datatypeStats["max"] = stats["max"];
                        }
                    }
                }, this);
                groupedStats[datatype] = datatypeStats;
            }, this);

            return groupedStats;
        };
    };

    ed.OD_event = function(metadataObj) {
        this.metadata = new ed.OD_eventMetadata(metadataObj);
        this.data = new ed.OD_eventDataCollection();
    };

    ed.OD_eventMetadata = function(obj) {
        this.id = obj['id'];
        this.name = obj['name'];
        this.displayName = obj['displayName'];
        this.description = obj['description'];
        this.datatype = obj['datatype'];
        this.allowedValues = obj['allowedValues'];
        this.minAllowedVal = obj['minAllowedVal'];
        this.maxAllowedVal = obj['maxAllowedVal'];
        this.weightedGeneVector = [];

        this.setScoreRange = function(minAllowed, maxAllowed) {
            this.minAllowedVal = minAllowed;
            this.maxAllowedVal = maxAllowed;
        };

        /**
         * weightVector is an array of objects with keys: 'gene', 'weight'.
         * scoredDatatype is the datatype to which the weights apply.
         */
        this.setWeightVector = function(weightVector, scoredDatatype) {
            this.weightedGeneVector = weightVector;
            this.scoredDatatype = scoredDatatype;
            return this;
        };

        /**
         * For an event that is a signature of weighted genes, sort genes by weight... heaviest at top
         */
        this.sortSignatureVector = function(reverse) {

            /**
             * comparator for weighted gene vector
             */
            var compareWeightedGenes = function(a, b) {
                var weightA = a['weight'];
                var weightB = b['weight'];
                return utils.compareAsNumeric(weightA, weightB);
            };

            var sig = this.weightedGeneVector.slice(0);
            sig.sort(compareWeightedGenes);

            // output sorted list of geness
            var geneList = [];
            for (var i = 0; i < sig.length; i++) {
                geneList.push(sig[i]['gene']);
            }

            if (reverse) {
            } else {
                geneList.reverse();
            }

            return geneList;
        };
    };

    ed.OD_eventDataCollection = function() {
        /**
         * list of sampleData objects with keys: 'id', 'val'.
         */
        this.dataCollection = [];

        function sampleData(id, val) {
            this.id = id;
            this.val = val;
        };

        /**
         * Get the percent of samples that have null data.
         */
        this.getPercentNullData = function() {
            var counts = this.getValueCounts();
            var percentNull = 0;
            if (null in counts) {
                var allSampleIds = this.getAllSampleIds();
                var totalCount = allSampleIds.length;
                var nullCounts = counts[null];
                percentNull = nullCounts / totalCount;
            }
            return percentNull;
        };

        /**
         * get the sample count for each value.  Useful for something like histogram.  Restrict to sample list, if given.
         */
        this.getValueCounts = function(sampleList) {
            var valCounts = {};
            // get sample data
            var dataList = this.getData(sampleList);

            // get the sample count for each value
            for (var i = 0; i < dataList.length; i++) {
                var dataObj = dataList[i];
                var val = dataObj['val'];
                if (!utils.hasOwnProperty(valCounts, val)) {
                    valCounts[val] = 0;
                }
                valCounts[val] = valCounts[val] + 1;
            }
            return valCounts;
        };

        /**
         * Get all data values.
         */
        this.getValues = function(dedup) {
            var valueCounts = this.getValueCounts();
            var vals = utils.getKeys(valueCounts);

            if ((dedup != null) && (dedup == true)) {
                vals = utils.eliminateDuplicates(vals);
            }
            return vals;
        };

        /**
         * dataObj is a dictionary of event values keyed on sampleId
         */
        this.setData = function(dataObj, isNumeric) {
            // this.dataCollection = [];
            for (var sampleId in dataObj) {
                var val = dataObj[sampleId];
                if ((val == "NaN") || (val == "null") || (val == "") || (val == "N/A")) {
                    // skip non-values
                    continue;
                }
                if ((isNumeric != null) && (isNumeric == true)) {
                    val = parseFloat(val);
                }
                this.dataCollection.push(new sampleData(sampleId, val));
            }
            return this;
        };

        /**
         * Order of samples is maintained... allows multi-sort.
         * If a specified ID is not found, then null is used for the value.
         * Restrict to sampleIdList, if given.
         */
        this.getData = function(sampleIdList) {
            // a mapping of sampleId to index
            var allSampleIds = this.getAllSampleIds(true);

            if (sampleIdList == null) {
                sampleIdList = utils.getKeys(allSampleIds);
            }
            var returnData = [];

            for (var i = 0; i < sampleIdList.length; i++) {
                var sampleId = sampleIdList[i];
                // check if sampleId is in allSampleIds
                if ( sampleId in allSampleIds) {
                    var index = allSampleIds[sampleId];
                    var data = this.dataCollection[index];
                    returnData.push(data);
                } else {
                    returnData.push(new sampleData(sampleId, null));
                }
            }
            return returnData;
        };

        /**
         * Get all sampleIds as array.  If indices == true, then return mapping of id to index.
         */
        this.getAllSampleIds = function(indices) {
            var ids = {};
            for (var i = 0; i < this.dataCollection.length; i++) {
                var data = this.dataCollection[i];
                var id = data['id'];
                ids[id] = i;
            }
            if (indices) {
                return ids;
            }
            return utils.getKeys(ids);
        };

        /**
         *Get the sampleIds with null data values
         */
        this.getNullSamples = function(inputIds) {
            var resultIds = [];
            var sampleData = this.getData(inputIds);
            for (var i = 0; i < sampleData.length; i++) {
                var data = sampleData[i];
                if (data['val'] == null) {
                    resultIds.push(data['id']);
                }
            }
            return resultIds;
        };

        /**
         * compare sample scores and return sorted list of sample IDs. If sortType == numeric, then numeric sort.  Else, sort as strings.
         */
        // TODO dead code?
        // this.sortSamples = function(sampleIdList, sortType) {
        // // sortingData has to be an array
        // var sortingData = this.getData(sampleIdList);
        //
        // // sort objects
        // var comparator = compareSamplesAsStrings;
        // if (sortType == null) {
        // sortType = 'categoric';
        // } else {
        // sortType = sortType.toLowerCase();
        // }
        //
        // if (((sortType == 'numeric') || (sortType == 'expression'))) {
        // comparator = compareSamplesAsNumeric;
        // } else if (sortType == 'date') {
        // comparator = compareSamplesAsDate;
        // }
        // sortingData.sort(comparator);
        //
        // // return row names in sorted order
        // var sortedNames = new Array();
        // for (var k = 0; k < sortingData.length; k++) {
        // sortedNames.push(sortingData[k]['id']);
        // }
        //
        // return sortedNames;
        // };

        /**
         * Select Ids with data that match a value. Restrict to startingIds, if given.
         */
        this.selectIds = function(selectVal, startingIds) {
            var selectedIds = [];

            var allData = (startingIds == null) ? this.getData() : this.getData(startingIds);
            for (var i = 0; i < allData.length; i++) {
                var data = allData[i];
                if (data['val'] == selectVal) {
                    selectedIds.push(data['id']);
                }
            }

            return selectedIds;
        };

        /** *get mean,sd,median,meddev,meandev.  Uses jStat library
         */
        this.getStats = function(sampleIdList, precision) {
            if ( typeof precision === 'undefined') {
                precision = 3;
            }
            var results = {
                'min' : 0,
                'max' : 0,
                'mean' : 0,
                'median' : 0,
                'sd' : 0,
                'meddev' : 0,
                'meandev' : 0,
                'percentNullData' : 0
            };

            results.percentNullData = this.getPercentNullData();
            results.percentNullData = results.percentNullData.toPrecision(precision);
            if (results.percentNullData == 1) {
                return results;
            }

            // a mapping of sampleId to index
            var allSampleIds = this.getAllSampleIds(true);

            if (sampleIdList == null) {
                sampleIdList = utils.getKeys(allSampleIds);
            }

            var vector = [];
            for (var i = 0; i < sampleIdList.length; i++) {
                var sampleId = sampleIdList[i];
                // check if sampleId is in allSampleIds
                if ( sampleId in allSampleIds) {
                    var index = allSampleIds[sampleId];
                    var data = this.dataCollection[index];
                    var val = null;
                    // be sure to use original values
                    if (utils.hasOwnProperty(data, 'val_orig')) {
                        val = data['val_orig'];
                    } else {
                        val = data['val'];
                    }
                    if (utils.isNumerical(val)) {
                        vector.push(val);
                    }
                }
            }

            if (vector.length == 0) {
                return results;
            }

            results['mean'] = jStat.mean(vector).toPrecision(precision);
            results['sd'] = jStat.stdev(vector).toPrecision(precision);
            results['median'] = jStat.median(vector).toPrecision(precision);
            results['meddev'] = jStat.meddev(vector).toPrecision(precision);
            results['meandev'] = jStat.meandev(vector).toPrecision(precision);
            results['min'] = jStat.min(vector).toPrecision(precision);
            results['max'] = jStat.max(vector).toPrecision(precision);

            return results;
        };
    };

    /**
     * Keep track of sorting.
     */
    ed.sortingSteps = function(arrayOfSteps) {
        this.steps = new Array();
        if (arrayOfSteps != null) {
            this.steps = arrayOfSteps;
        }

        this.getSteps = function() {
            return this.steps;
        };

        this.getIndex = function(name) {
            var result = -1;
            for (var i = 0; i < this.steps.length; i++) {
                if (this.steps[i]["name"] == name) {
                    return i;
                }
            }
            return result;
        };

        /**
         * noReverse = true to just bring a step to the front
         */
        this.addStep = function(name, noReverse) {
            var index = this.getIndex(name);
            if (index >= 0) {
                var c = this.steps.splice(index, 1)[0];
                if (!noReverse) {
                    c["reverse"] = !c["reverse"];
                }
                this.steps.push(c);
            } else {
                this.steps.push({
                    "name" : name,
                    "reverse" : false
                });
            }
        };

        this.removeStep = function(name) {
            var index = this.getIndex(name);
            if (index >= 0) {
                this.steps.splice(index, 1);
            }
        };

        this.clearSteps = function() {
            this.steps.splice(0, this.steps.length);
        };
    };

    /**
     * Object to help with selecting sample IDs based on selection criteria.
     */
    ed.sampleSelectionCriteria = function() {
        this.criteria = new Array();

        this.getCriteria = function() {
            return this.criteria;
        };

        this.addCriteria = function(eventId, value) {
            var criteria = {
                "eventId" : eventId,
                "value" : value
            };
            for (var i in this.criteria) {
                if (JSON.stringify(this.criteria[i]) == JSON.stringify(criteria)) {
                    return;
                }
            }
            this.criteria.push(criteria);
        };

        this.removeCriteria = function(eventId, value) {
            for (var i = 0; i < this.criteria.length; i++) {
                if ((this.criteria[i]["eventId"] == eventId) && (this.criteria[i]["value"] == value)) {
                    this.criteria.splice(i, 1);
                    break;
                }
            }
        };

        this.clearCriteria = function() {
            this.criteria.splice(0, this.criteria.length);
        };
    };

})(eventData);
