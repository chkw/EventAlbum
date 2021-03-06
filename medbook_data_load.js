/**
 * chrisw@soe.ucsc.edu
 * 27AUG14
 * medbook_data_load.js is meant to load cBio/medbook data into data objects.
 */

// cBio-Medbook api:
// https://medbook.ucsc.edu/cbioportal/webservice.do?cmd=getClinicalData&case_set_id=prad_wcdt_all
// https://medbook.ucsc.edu/cbioportal/webservice.do?cmd=getMutationData&case_set_id=prad_wcdt_all&genetic_profile_id=prad_wcdt_mutations&gene_list=AKT1+AKT2+RB1+PTEN
// https://medbook.ucsc.edu/cbioportal/webservice.do?cmd=getCaseLists&cancer_study_id=prad_wcdt

// var clinicalDataFileUrl = 'observation_deck/data/cbioMedbook/data_clinical.txt';
// var caseListsFileUrl = 'observation_deck/data/cbioMedbook/getCaseLists.txt';
// var mutationDataFileUrl = 'observation_deck/data/cbioMedbook/mutation.txt';
// var expressionDataFileUrl = 'observation_deck/data/cbioMedbook/expressionData.tab';

var medbookDataLoader = medbookDataLoader || {};

(function(mdl) {"use strict";
    mdl.transposeClinicalData = function(input, recordKey) {
        var transposed = {};
        for (var i = 0; i < input.length; i++) {
            var obj = input[i];
            var case_id = obj[recordKey];
            // delete (obj[recordKey]);
            for (var key in obj) {
                if ( key in transposed) {
                } else {
                    transposed[key] = {};
                }
                transposed[key][case_id] = obj[key];
            }
        }
        return transposed;
    };

    /**
     * The clinical data file looks like this:

     #Sample f1    f2   f3     f4
     #Sample f1    f2   f3     f4
     STRING  STRING  DATE    STRING  STRING
     SAMPLE_ID       f1    f2   f3     f4
     1 UCSF    6/15/2012       Bone    Resistant
     2 UCSF    12/15/2012      Liver   Naive
     3 UCSF    2/26/2013       Liver   Naive
     4 UCSF    2/21/2013       Liver   Naive

     * @param {Object} url
     * @param {Object} OD_eventAlbum
     */
    mdl.getClinicalData = function(url, OD_eventAlbum) {
        var response = utils.getResponse(url);
        var lines = response.split('\n');

        var dataLines = [];
        var commentLines = [];
        var types = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (utils.beginsWith(line, '#')) {
                commentLines.push(line);
            } else if (utils.beginsWith(line, 'STRING')) {
                types = line.split('\t');
            } else {
                dataLines.push(line);
            }
        }

        var parsedResponse = d3.tsv.parse(dataLines.join('\n'));
        var transposed = this.transposeClinicalData(parsedResponse, 'SAMPLE_ID');
        delete transposed['SAMPLE_ID'];

        var eventIdList = utils.getKeys(transposed);
        for (var i = 0; i < eventIdList.length; i++) {
            var eventId = eventIdList[i];
            var clinicalData = transposed[eventId];
            var type = types[i + 1];

            var allowedValues = 'categoric';
            if (type.toLowerCase() == 'number') {
                allowedValues = 'numeric';
            } else if (type.toLowerCase() == 'date') {
                allowedValues = 'date';
            }

            // OD_eventAlbum.addEvent({
            // 'id' : eventId,
            // 'name' : null,
            // 'displayName' : null,
            // 'description' : null,
            // 'datatype' : 'clinical data',
            // 'allowedValues' : allowedValues
            // }, clinicalData);

            mdl.loadEventBySampleData(OD_eventAlbum, eventId, '', 'clinical data', allowedValues, clinicalData);

        }

        return parsedResponse;
    };

    /**
     * The mutation data file is a maf file and looks like this:

     Hugo_Symbol     Entrez_Gene_Id  Center  NCBI_Build
     PEG10   23089   ucsc.edu        GRCh37-lite
     CNKSR3  154043  ucsc.edu        GRCh37-lite
     ANK2    287     ucsc.edu        GRCh37-lite
     ST8SIA4 7903    ucsc.edu        GRCh37-lite
     RUNX1T1 862     ucsc.edu        GRCh37-lite
     GABRB3  2562    ucsc.edu        GRCh37-lite

     * @param {Object} url
     * @param {Object} OD_eventAlbum
     */
    mdl.getMutationData = function(url, OD_eventAlbum) {
        var response = utils.getResponse(url);
        var parsedResponse = d3.tsv.parse(response);

        var dataByGene = {};

        for (var i = 0; i < parsedResponse.length; i++) {
            var parsedData = parsedResponse[i];
            var gene = parsedData['Hugo_Symbol'];
            var classification = parsedData['Variant_Classification'];
            var variantType = parsedData['Variant_Type'];
            var sampleId = parsedData['Tumor_Sample_Barcode'];

            // maf file uses - instead of _
            sampleId = sampleId.replace(/_/g, '-');

            // some samples have trailing [A-Z]
            sampleId = sampleId.replace(/[A-Z]$/, '');

            if (!utils.hasOwnProperty(dataByGene, gene)) {
                dataByGene[gene] = {};
                dataByGene[gene]['metadata'] = {
                    'id' : gene + '_mut',
                    'name' : null,
                    'displayName' : null,
                    'description' : null,
                    'datatype' : 'mutation data',
                    'allowedValues' : 'categoric'
                };
                dataByGene[gene]['data'] = {};
            }

            dataByGene[gene]['data'][sampleId] = true;
        }

        // add mutation events
        var mutatedGenes = utils.getKeys(dataByGene);
        for (var j = 0; j < mutatedGenes.length; j++) {
            var mutatedGene = mutatedGenes[j];
            var mutationData = dataByGene[mutatedGene];
            OD_eventAlbum.addEvent(mutationData['metadata'], mutationData['data']);
        }

        return dataByGene;
    };

    /**
     * The expression data looks like this:

     a b c
     ACOT9   7.89702013149366        4.56919333525263        7.30772632354453
     ADM     9.8457751118653 1       3.92199798893442
     AGR2    14.0603428300693        1       9.25656041315632
     ANG     3.47130453638819        4.56919333525263        6.94655542449336
     ANK2    6.22356349157533        10.7658085407174        12.4021643510831

     * @param {Object} url
     * @param {Object} OD_eventAlbum
     */
    mdl.getExpressionData = function(url, OD_eventAlbum) {
        mdl.getGeneBySampleData(url, OD_eventAlbum, '_mRNA', 'expression data', 'numeric');
    };

    mdl.getViperData = function(url, OD_eventAlbum) {
        mdl.getGeneBySampleData(url, OD_eventAlbum, '_viper', 'viper data', 'numeric');
    };

    /**
     * where the event is a gene
     */
    mdl.getGeneBySampleData = function(url, OD_eventAlbum, geneSuffix, datatype, allowedValues) {
        var response = utils.getResponse(url);
        var parsedResponse = d3.tsv.parse(response);

        for (var eventType in parsedResponse) {
            var data = parsedResponse[eventType];
            var geneId = data[''];
            delete data[''];

            mdl.loadEventBySampleData(OD_eventAlbum, geneId, geneSuffix, datatype, allowedValues, data);
        }
    };

    // TODO loadEventBySampleData
    mdl.loadEventBySampleData = function(OD_eventAlbum, feature, suffix, datatype, allowedValues, data) {
        var eventObj = OD_eventAlbum.addEvent({
            'geneSuffix' : suffix,
            'id' : feature + suffix,
            'name' : datatype + ' for ' + feature,
            'displayName' : feature,
            'description' : null,
            'datatype' : datatype,
            'allowedValues' : allowedValues
        }, data);
        return eventObj;
    };

    /**
     * gaData looks like this:
     {
     "_id": {
     "_str": "56bd09c433cbfe5c8a00ae49"
     },
     "collaborations": [
     "WCDT"
     ],
     "gene_label": "MDM4",
     "sample_label": "DTB-005",
     "study_label": "prad_wcdt",
     "gistic_copy_number": 0.23
     }
     */
    mdl.mongoGeneAnnotationData = function(gaData, OD_eventAlbum) {
        _.each(gaData, function(data) {
            // remove unused fields
            delete data["_id"];
            delete data["collaborations"];
            delete data["study_label"];

            var gene = data["gene_label"];
            delete data["gene_label"];

            var sample = data["sample_label"];
            delete data["sample_label"];

            // remaining keys should be datatypes
            _.each(_.keys(data), function(datatype) {
                var value = data[datatype];

                // get eventObj
                var suffix = "_" + datatype;
                var eventId = gene + suffix;
                var eventObj = OD_eventAlbum.getEvent(eventId);
                // create event if DNE
                if (eventObj == null) {
                    eventObj = mdl.loadEventBySampleData(OD_eventAlbum, eventId, "", datatype, 'numeric', []);
                    eventObj.metadata.displayName = gene;
                }

                // add data to eventObj
                var dataObj = {};
                dataObj[sample] = value;
                eventObj.data.setData(dataObj);
            });
        });
    };

    /**
     * A contrast is one row of clinical data.
     */
    mdl.mongoContrastData = function(contrastData, OD_eventAlbum) {
        if (_.isUndefined(contrastData)) {
            return null;
        }

        // create eventObj
        var eventId = "contrast";
        var eventObj = OD_eventAlbum.getEvent(eventId);

        // add event if DNE
        if (eventObj == null) {
            eventObj = mdl.loadEventBySampleData(OD_eventAlbum, eventId, '', 'clinical data', 'categoric', []);
        }

        // load event data
        var value = contrastData["group1"];
        _.each(contrastData["list1"], function(sampleId) {
            var data = {};
            data[sampleId] = value;
            eventObj.data.setData(data);
        });

        value = contrastData["group2"];
        _.each(contrastData["list2"], function(sampleId) {
            var data = {};
            data[sampleId] = value;
            eventObj.data.setData(data);
        });

        return eventObj;
    };

    /**
     *Add clinical data from mongo collection.
     * @param {Object} collection
     * @param {Object} OD_eventAlbum
     */
    mdl.mongoClinicalData = function(collection, OD_eventAlbum) {
        // iter over doc (each doc = sample)
        for (var i = 0; i < collection.length; i++) {
            var doc = collection[i];

            var sampleId = null;
            // col name for this field has been inconsistent, so try to detect it here
            if (utils.hasOwnProperty(doc, 'sample')) {
                sampleId = doc['sample'];
            } else if (hasOwnProperty(doc, 'Sample')) {
                sampleId = doc['Sample'];
            } else if (hasOwnProperty(doc, 'Patient ID')) {
                sampleId = doc['Patient ID'];
            } else if (hasOwnProperty(doc, 'Patient ID ')) {
                sampleId = doc['Patient ID '];
            } else {
                // no gene identifier found
                console.log('no sample ID found in clinical doc: ' + prettyJson(doc));
                continue;
            }

            sampleId = sampleId.trim();

            // don't use this field
            if ((sampleId === 'Patient ID') || (sampleId === 'Patient ID ')) {
                continue;
            }

            // iter over event names (file columns)
            var keys = utils.getKeys(doc);
            for (var j = 0; j < keys.length; j++) {
                var key = keys[j];
                if (utils.isObjInArray(['_id', 'sample', 'Sample'], key)) {
                    // skip these file columns
                    continue;
                }
                var eventObj = OD_eventAlbum.getEvent(key);

                // add event if DNE
                if (eventObj == null) {
                    eventObj = mdl.loadEventBySampleData(OD_eventAlbum, key, '', 'clinical data', 'categoric', []);
                }
                var value = doc[key];
                var data = {};
                data[sampleId] = value;
                eventObj.data.setData(data);
            }
        }
        return eventObj;
    };

    /**
     * Load a matrix of signature data from a string.
     */
    mdl.genericMatrixData = function(matrixString, dataName, OD_eventAlbum, allowedValues) {
        var parsedMatrix = d3.tsv.parse(matrixString);
        // var allowedValues = "numeric";
        var sanitizedDataName = dataName.replace(/ /, "_");

        var returnFeatures = [];

        _.each(parsedMatrix, function(row) {
            var colNames = _.keys(row);
            var featureKey = colNames.shift();
            var feature = row[featureKey];
            delete row[featureKey];

            if (dataName === "clinical data") {
                mdl.loadEventBySampleData(OD_eventAlbum, feature, "", "clinical data", "categoric", row);
                returnFeatures.push(feature);
            } else {
                mdl.loadEventBySampleData(OD_eventAlbum, feature, "_" + sanitizedDataName, dataName, allowedValues, row);
                returnFeatures = [dataName];
            }
            // mdl.loadEventBySampleData(OD_eventAlbum, feature, "_viper", "viper data", allowedValues, row);
        });
        return returnFeatures;
    };

    /**
     *
     */
    mdl.mongoViperSignaturesData = function(collection, OD_eventAlbum) {
        // iter over doc (each doc = signature)
        for (var i = 0, length = collection.length; i < length; i++) {
            var doc = collection[i];
            var type = doc["type"];
            var algorithm = doc["algorithm"];
            var label = doc["label"];
            var gene_label = doc["gene_label"];

            var sample_values;
            var docKeys = _.keys(doc);
            if (_.contains(docKeys, "sample_values")) {
                sample_values = doc["sample_values"];
            } else if (_.contains(docKeys, "samples")) {
                sample_values = doc["samples"];
            } else {
                console.log("no sample data found", type, algorithm, gene_label);
                continue;
            }

            var sampleData = {};
            for (var j = 0, lengthj = sample_values.length; j < lengthj; j++) {
                var sampleValue = sample_values[j];
                // var patient_label = sampleValue["patient_label"];
                var sample_label = sampleValue["sample_label"];
                var value = sampleValue["value"];

                sampleData[sample_label] = value;
            }

            // TODO version number ??
            var datatype = type + "_" + algorithm;
            var suffix = "_" + datatype;
            var eventId = gene_label + suffix;
            var eventObj = OD_eventAlbum.getEvent(eventId);

            // add event if DNE
            if (eventObj == null) {
                eventObj = mdl.loadEventBySampleData(OD_eventAlbum, gene_label, "_viper", 'viper data', 'numeric', sampleData);
            } else {
                eventObj.data.setData(sampleData);
            }
        }
    };

    /**
     * add patient labels to samples
     */
    mdl.patientSamplesData = function(patientSamplesArray, OD_eventAlbum) {
        var eventName = "patientSamples";
        var dataBySample = {};

        _.each(patientSamplesArray, function(patientSampleObj, index) {
            var patient_label = patientSampleObj["patient_label"];
            var sample_labels = patientSampleObj["sample_labels"];
            _.each(sample_labels, function(sampleId, indexj) {
                dataBySample[sampleId] = patient_label;
            });
        });

        var eventObj = OD_eventAlbum.getEvent(eventName);
        // add event if DNE
        if (eventObj == null) {
            eventObj = mdl.loadEventBySampleData(OD_eventAlbum, eventName, '', 'clinical data', 'categoric', []);
        }
        eventObj.data.setData(dataBySample);
    };

    /**
     * load sample data for hallmarks-of-cancer mode
     * The expected sample data is a 2D matrix. cols are samples. rows are features.
     */
    mdl.hallmarksSampleData = function(sampleData, OD_eventAlbum) {
        console.log("hallmarksSampleData");

        var parsedSampleData = d3.tsv.parse(sampleData);
        _.each(parsedSampleData, function(data) {
            delete data["Kinases"];
        });

        var processedSampleData = d3.tsv.format(parsedSampleData);

        mdl.genericMatrixData(processedSampleData, "hallmarks", OD_eventAlbum, "numeric");
    };

    /**
     *Add expression data from mongo collection.
     * @param {Object} collection
     * @param {Object} OD_eventAlbum
     */
    mdl.mongoExpressionData = function(collection, OD_eventAlbum) {
        // iter over doc (each doc = sample)
        for (var i = 0; i < collection.length; i++) {
            var doc = collection[i];

            // get gene
            var gene = null;
            if (utils.hasOwnProperty(doc, 'gene')) {
                gene = doc['gene'];
            } else if (utils.hasOwnProperty(doc, 'id')) {
                gene = doc['id'];
            } else {
                // no gene identifier found
                console.log('no gene identifier found in expression doc: ' + utils.prettyJson(doc));
                continue;
            }

            gene = gene.trim();
            var suffix = '_mRNA';
            var eventId = gene + suffix;

            // iter over samples
            var samples = utils.getKeys(doc);
            var sampleObjs = doc['samples'];
            // build up sampleData obj
            var sampleData = {};
            for (var sampleId in sampleObjs) {
                var scoreObj = sampleObjs[sampleId];
                var score = scoreObj["rsem_quan_log2"];
                sampleData[sampleId] = score;
            }

            var eventObj = OD_eventAlbum.getEvent(eventId);

            // add event if DNE
            if (eventObj == null) {
                eventObj = mdl.loadEventBySampleData(OD_eventAlbum, gene, suffix, 'expression data', 'numeric', sampleData);
            } else {
                eventObj.data.setData(sampleData);
            }
        }
    };

    /**
     * data about mutation type
     */
    mdl.mongoMutationData = function(collection, OD_eventAlbum) {
        // iter over doc ... each doc is a mutation call
        var allowed_values = "mutation type";

        var impactScoresMap = OD_eventAlbum.ordinalScoring[allowed_values];

        var mutTypeByGene = {};
        var impactScoreByGene = {};
        // for (var i = 0, length = collection.length; i < length; i++) {
        _.each(collection, function(element) {
            var doc = element;

            var sample = doc["sample_label"];
            var gene = doc["gene_label"];
            // var type = doc["mutation_type"];
            var sequenceOntology = doc["sequence_ontology"];
            // from http://www.cravat.us/help.jsp?chapter=help_user_account&article=top#sequence_ontology
            // SY	Synonymous Variant
            // SL	Stop Lost
            // SG	Stop Gained
            // MS	Missense Variant
            // II	Inframe Insertion
            // FI	Frameshift Insertion
            // ID	Inframe Deletion
            // FD	Frameshift Deletion
            // CS	Complex Substitution

            var effectMapping = {
                "SY" : "silent",
                "SL" : "snp",
                "SG" : "snp",
                "MS" : "snp",
                "II" : "ins",
                "FI" : "ins",
                "ID" : "del",
                "FD" : "del",
                "CS" : "snp",
                "SS" : "snp" // not confirmed by documentation
            };

            var effect = effectMapping[sequenceOntology];

            // handle sequenceOntology
            if (! _.isUndefined(effect)) {
                effect = effect.toLowerCase();
                if (! utils.hasOwnProperty(mutTypeByGene, gene)) {
                    mutTypeByGene[gene] = {};
                }

                if (! utils.hasOwnProperty(mutTypeByGene[gene], sample)) {
                    mutTypeByGene[gene][sample] = [];
                }

                var findResult = _.findWhere(mutTypeByGene[gene][sample], effect);
                if (_.isUndefined(findResult)) {
                    mutTypeByGene[gene][sample].push(effect);
                }
            }
            // handle impact score
            var impact_assessor = (_.contains(_.keys(doc), "mutation_impact_assessor")) ? doc["mutation_impact_assessor"] : null;
            if (!_.isNull(impact_assessor) && impact_assessor.toLowerCase() === "chasm") {
                var chasmScore = doc["chasm_driver_score"];

                if (_.isUndefined(impactScoreByGene[gene])) {
                    impactScoreByGene[gene] = {};
                }

                if (_.isUndefined(impactScoreByGene[gene][sample])) {
                    impactScoreByGene[gene][sample] = 1;
                }

                if (impactScoreByGene[gene][sample] > chasmScore) {
                    impactScoreByGene[gene][sample] = chasmScore;
                }
            } else {
                console.log("NO CHASM for", sample, gene);
            }
        });
        console.log("mutTypeByGene", mutTypeByGene);
        console.log("impactScoreByGene", impactScoreByGene);

        // mutation type - add to event album
        var suffix = "_mutation";
        _.each(_.keys(mutTypeByGene), function(gene) {
            var sampleData = mutTypeByGene[gene];
            mdl.loadEventBySampleData(OD_eventAlbum, gene, suffix, 'mutation call', allowed_values, sampleData);
        });

        // mutation impact
        suffix = "_mutation_impact_score";
        allowed_values = "chasm";
        _.each(_.keys(impactScoreByGene), function(gene) {
            var sampleData = impactScoreByGene[gene];
            mdl.loadEventBySampleData(OD_eventAlbum, gene, suffix, 'mutation impact score', allowed_values, sampleData);
        });

        return null;
    };

    /**
     * data about mutation type
     */
    mdl.mongoMutationData_old = function(collection, OD_eventAlbum) {
        // iter over doc ... each doc is a mutation call
        var allowed_values = "mutation type";

        var impactScoresMap = OD_eventAlbum.ordinalScoring[allowed_values];

        var mutByGene = {};
        // for (var i = 0, length = collection.length; i < length; i++) {
        _.each(collection, function(element) {
            var doc = element;

            var sample = doc["sample_label"];
            var gene = doc["gene_label"];
            var type = doc["mutation_type"];
            var impact_assessor = (_.contains(_.keys(doc), "mutation_impact_assessor")) ? doc["mutation_impact_assessor"] : null;

            if (! utils.hasOwnProperty(mutByGene, gene)) {
                mutByGene[gene] = {};
            }

            if (! utils.hasOwnProperty(mutByGene[gene], sample)) {
                mutByGene[gene][sample] = [];
            }

            var findResult = _.findWhere(mutByGene[gene][sample], type);
            if (_.isUndefined(findResult)) {
                mutByGene[gene][sample].push(type);
            }
        });
        console.log("mutByGene", mutByGene);

        // add to event album
        var genes = utils.getKeys(mutByGene);
        var suffix = "_mutation";
        for (var i = 0, length = genes.length; i < length; i++) {
            var gene = genes[i];
            var sampleData = mutByGene[gene];
            mdl.loadEventBySampleData(OD_eventAlbum, gene, suffix, 'mutation call', allowed_values, sampleData);
        }

        return null;
    };

    /**
     * Data about mutation impact
     */
    mdl.mongoMutationData_impact = function(collection, OD_eventAlbum) {
        // iter over doc ... each doc is a mutation call
        var allowed_values = "mutation impact";

        var impactScoresMap = OD_eventAlbum.ordinalScoring[allowed_values];
        var mutByGene = {};
        for (var i = 0, length = collection.length; i < length; i++) {
            var doc = collection[i];

            var sample = doc["sample_label"];
            var gene = doc["gene_label"];
            var type = doc["mutation_type"];
            var impact = doc["effect_impact"];

            if (! utils.hasOwnProperty(mutByGene, gene)) {
                mutByGene[gene] = {};
            }

            // TODO score by greatest impact
            if (! utils.hasOwnProperty(mutByGene[gene], sample)) {
                mutByGene[gene][sample] = impact;
            } else {
                var recordedImpact = mutByGene[gene][sample];
                if (impactScoresMap[impact] > impactScoresMap[recordedImpact]) {
                    mutByGene[gene][sample] = impact;
                } else {
                    continue;
                }
            }
        }

        // add to event album
        var genes = utils.getKeys(mutByGene);
        var suffix = "_mutation";
        for (var i = 0, length = genes.length; i < length; i++) {
            var gene = genes[i];
            var sampleData = mutByGene[gene];
            mdl.loadEventBySampleData(OD_eventAlbum, gene, suffix, 'mutation call', allowed_values, sampleData);
        }

        return null;
    };

    /**
     *Add expression data from mongo collection.
     * @param {Object} collection
     * @param {Object} OD_eventAlbum
     */
    mdl.mongoExpressionData_old = function(collection, OD_eventAlbum) {
        // iter over doc (each doc = sample)
        for (var i = 0; i < collection.length; i++) {
            var doc = collection[i];

            var gene = null;
            if (utils.hasOwnProperty(doc, 'gene')) {
                gene = doc['gene'];
            } else if (utils.hasOwnProperty(doc, 'id')) {
                gene = doc['id'];
            } else {
                // no gene identifier found
                console.log('no gene identifier found in expression doc: ' + utils.prettyJson(doc));
                continue;
            }

            gene = gene.trim();
            var suffix = '_mRNA';
            var eventId = gene + suffix;

            // iter over samples
            var samples = utils.getKeys(doc);
            for (var j = 0; j < samples.length; j++) {
                var sample = samples[j];
                if (utils.isObjInArray(['_id', 'gene', 'id'], sample)) {
                    // skip these 'samples'
                    continue;
                }
                var eventObj = OD_eventAlbum.getEvent(eventId);

                // add event if DNE
                if (eventObj == null) {
                    eventObj = mdl.loadEventBySampleData(OD_eventAlbum, gene, suffix, 'expression data', 'numeric', []);
                }
                var value = doc[sample];
                var data = {};
                data[sample] = parseFloat(value);
                eventObj.data.setData(data);
            }
        }
        return eventObj;
    };

    /**
     *Get a signature via url.  This one does not load sample data.
     * @param {Object} url
     * @param {Object} OD_eventAlbum
     */
    mdl.getSignature = function(url, OD_eventAlbum) {
        var response = utils.getResponse(url);
        var parsedResponse = d3.tsv.parse(response);

        var eventId = url.split('/').pop();

        var eventObj = OD_eventAlbum.getEvent(eventId);

        // add event if DNE
        if (eventObj == null) {
            OD_eventAlbum.addEvent({
                'id' : eventId,
                'name' : null,
                'displayName' : null,
                'description' : null,
                'datatype' : 'expression signature',
                'allowedValues' : 'numeric',
                'weightedGeneVector' : parsedResponse
            }, []);
            eventObj = OD_eventAlbum.getEvent(eventId);
        }
        return eventObj;
    };

    /**
     * Load sample signature scores.
     * @param {Object} obj  mongo collection... an array of {'id':sampleId, 'name':eventId, 'val':sampleScore}
     * @param {Object} OD_eventAlbum
     */
    mdl.loadSignatureObj = function(obj, OD_eventAlbum) {
        var sigScoresMongoDocs = obj;

        // group data by eventID
        var groupedData = {};
        for (var i = 0; i < sigScoresMongoDocs.length; i++) {
            var mongoDoc = sigScoresMongoDocs[i];
            var id = mongoDoc['id'];
            var name = mongoDoc['name'];
            var val = mongoDoc['val'];

            if (! utils.hasOwnProperty(groupedData, name)) {
                groupedData[name] = {};
            }
            groupedData[name][id] = val;
        }

        // set eventData
        var eventIds = utils.getKeys(groupedData);
        for (var i = 0; i < eventIds.length; i++) {
            var eventId = eventIds[i];
            var eventData = groupedData[eventId];

            var datatype;
            var fields = eventId.split('_v');
            var version = fields.pop();
            var rootName = fields.join('_v');
            var suffix = "";
            if (utils.endsWith(rootName, '_kinase_viper')) {
                datatype = 'kinase target activity';
                // suffix = '_kinase_viper';
                // eventId = rootName.replace(suffix,"");
            } else if (utils.endsWith(rootName, '_tf_viper') || utils.beginsWith(rootName, 'tf_viper_')) {
                datatype = 'tf target activity';
                // suffix = '_tf_viper';
                // eventId = rootName.replace(suffix,"");
            } else if (utils.endsWith(rootName, '_mvl_drug_sensitivity') || utils.beginsWith(rootName, 'mvl_drug_sensitivity_')) {
                datatype = 'mvl drug sensitivity';
                // suffix = '_mvl_drug_sensitivity';
                // eventId = rootName.replace(suffix,"");
            } else {
                datatype = 'expression signature';
            }

            var eventObj = OD_eventAlbum.getEvent(eventId);

            // add event if DNE
            if (eventObj == null) {
                eventObj = mdl.loadEventBySampleData(OD_eventAlbum, eventId, suffix, datatype, 'numeric', {});
                eventObj.metadata.setWeightVector([], "expression data");
            }

            eventObj.data.setData(eventData);
        }

    };

    // TODO qqq
    mdl.loadSignatureWeightsObj = function(obj, OD_eventAlbum) {
        // fields: name and version and signature... signature is an obj keyed by gene {'weight':weight,'pval':pval}
        var eventId = obj['name'] + '_v' + obj['version'];

        var datatype;
        if (utils.endsWith(obj['name'], '_kinase_viper')) {
            datatype = 'kinase target activity';
        } else if (utils.endsWith(obj['name'], '_tf_viper') || utils.beginsWith(obj['name'], 'tf_viper_')) {
            datatype = 'tf target activity';
        } else if (utils.endsWith(obj['name'], '_mvl_drug_sensitivity') || utils.beginsWith(obj['name'], 'mvl_drug_sensitivity_')) {
            datatype = 'mvl drug sensitivity';
        } else {
            datatype = "expression signature";
        }

        var eventObj = OD_eventAlbum.getEvent(eventId);

        // weightedGeneVector to be converted to Array of {'gene':gene,'weight':weight}
        var weightedGeneVector = [];
        var signatures = obj['signature'];
        var genes = utils.getKeys(signatures);
        for (var i = 0; i < genes.length; i++) {
            var gene = genes[i];
            var data = signatures[gene];
            weightedGeneVector.push({
                'gene' : gene,
                'weight' : data['weight']
            });
        }

        if (eventObj == null) {
            // create eventObj
            eventObj = mdl.loadEventBySampleData(OD_eventAlbum, eventId, '', datatype, 'numeric', []);
        }
        eventObj.metadata.setWeightVector(weightedGeneVector, 'expression data');
        var size = eventObj.metadata.weightedGeneVector.length;

        return eventObj;
    };

    /**
     * This loader loads signature weights data as sample data.  Events are genes, samples are signatures, data are weights (hopfully, normalized).
     * @param {Object} obj
     * @param {Object} OD_eventAlbum
     */
    mdl.loadBmegSignatureWeightsAsSamples = function(obj, OD_eventAlbum) {
        // build up objects that can be loaded into event album

        // get query genes
        var queryObj = obj['query'];
        var queryGeneList = utils.getKeys(queryObj['weights']);

        // get feature obj
        var featuresObj = obj['features'];
        var featureObjList = [];
        var featureGenes = [];
        for (var feature in featuresObj) {
            var weightiness = featuresObj[feature];
            featureObjList.push({
                "gene" : feature,
                "weight" : weightiness
            });
            featureGenes.push(feature);
        }
        featureGenes = utils.eliminateDuplicates(featureGenes);

        // get signature gene weight data
        var signaturesDict = obj['signatures'];
        var geneWiseObj = {};
        var queryScores = {};

        for (var signatureName in signaturesDict) {
            var signatureObj = signaturesDict[signatureName];
            var score = signatureObj['score'];
            queryScores[signatureName] = score;

            var weights = signatureObj['weights'];
            // var geneList = utils.getKeys(weights);

            var geneList = queryGeneList.slice(0);
            geneList = geneList.concat(utils.getKeys(weights));
            geneList = utils.eliminateDuplicates(geneList);

            for (var j = 0, geneListLength = geneList.length; j < geneListLength; j++) {
                var gene = geneList[j];

                // only keep certain genes
                if ((! utils.isObjInArray(queryGeneList, gene)) && (! utils.isObjInArray(featureGenes, gene))) {
                    continue;
                }
                var weight = weights[gene];
                if ( typeof weight === "undefined") {
                    continue;
                }
                if (! utils.hasOwnProperty(geneWiseObj, gene)) {
                    geneWiseObj[gene] = {};
                }
                geneWiseObj[gene][signatureName] = weight;
            }
        }

        console.log('num genes:' + utils.getKeys(geneWiseObj).length);

        // query score event
        var eventObj = mdl.loadEventBySampleData(OD_eventAlbum, 'query_score', '', 'signature query score', 'numeric', queryScores);
        eventObj.metadata.setWeightVector(featureObjList, "signature weight");

        // load data into event album
        var geneList = utils.getKeys(geneWiseObj);
        for (var i = 0; i < geneList.length; i++) {
            var gene = geneList[i];
            var eventId = gene + "_weight";
            var sigEventObj = OD_eventAlbum.getEvent(eventId);

            if (sigEventObj == null) {
                // create eventObj

                sigEventObj = mdl.loadEventBySampleData(OD_eventAlbum, gene, '_weight', 'signature weight', 'numeric', geneWiseObj[gene]);
                sigEventObj.metadata.setScoreRange(-1, 1);
            } else {
                console.log('loadBmegSignatureWeightsAsSamples:', 'existing event for: ' + eventId);
            }
        }
    };

    /**
     * pivot scores assign a score to events for the purpose of sorting by (anti)correlation.
     * Pivot scores to be loaded into the album as a special object.
     * In medbook-workbench, this is the correlator subscription.
     * @param {Object} obj
     * @param {Object} OD_eventAlbum
     */
    mdl.loadPivotScores = function(collection, OD_eventAlbum) {
        // get a dictionary of {key,val}
        var pivotScores = [];
        for (var i = 0; i < collection.length; i++) {
            var doc = collection[i];

            // get correlated event info and score
            var eventId1 = doc['name_1'];
            var version1 = doc['version_1'];
            var datatype1 = doc['datatype_1'];

            var getEventId = function(name, datatype, version) {
                var newName;
                if (datatype === 'signature') {
                    newName = name + '_v' + version;
                    // } else if (utils.endsWith(name, "_tf_viper")) {
                    // datatype = 'signature';
                    // newName = name.replace('_tf_viper', '');
                    // newName = "tf_viper_" + newName + "_v" + "4";
                } else if (datatype === 'expression') {
                    // no suffix here, just the gene symbol
                    // newName = name + "_mRNA";
                    newName = name;
                } else {
                    newName = name;
                }
                if ( typeof newName === "undefined") {
                    console.log("undefined name for", name, datatype, version);
                }
                return newName;
            };

            eventId1 = getEventId(eventId1, datatype1, version1);

            var eventId2 = doc['name_2'];
            var version2 = doc['version_2'];
            var datatype2 = doc['datatype_2'];

            eventId2 = getEventId(eventId2, datatype2, version2);

            var score = doc['score'];

            // set pivotScoreData
            pivotScores.push({
                'eventId1' : eventId1,
                'eventId2' : eventId2,
                'score' : score
            });

        }
        OD_eventAlbum.setPivotScores_array(null, pivotScores);
    };

    /**
     * Set the tested samples for a datatype.
     * @param {Object} datatype
     * @param {Object} testedSamples
     * @param {Object} OD_eventAlbum
     */
    mdl.setTestedSamples = function(datatype, testedSamples, OD_eventAlbum) {
        OD_eventAlbum.setTestedSamples(datatype, testedSamples);
    };

})(medbookDataLoader);
