sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/comp/smartfilterbar/SmartFilterBar",
    "sap/m/ComboBox",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    'sap/ui/export/Spreadsheet',
    'sap/ui/export/library',
],
    function (Filter, FilterOperator, SmartFilterBar, ComboBox, Fragment, MessageBox, Spreadsheet, exportLibrary) {
        "use strict";
        return {
            onInit: function (oEvent) {
                if (!this._sIdPrefix) {
                    this._sIdPrefix =
                        "com.rs.cf.grplservicedocumentrecord::sap.suite.ui.generic.template.ListReport.view.ListReport::ServiceDocument--";
                }
                this.oView = this.getView();
                this.oGridTable = this.oView.byId(this._sIdPrefix + "GridTable");

                this.oDataModel = this.getOwnerComponent().getModel();
                this.oAppModel = this.getOwnerComponent().getModel("appModel");
                this.oTranslationBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            },

            onAfterRendering: function () {
                let oDeleteBtn = this.oView.byId(this._sIdPrefix + "deleteEntry");
                // oDeleteBtn.setVisible(false);
                // Automatically adjust column whidts 
                this.oGridTable.attachBusyStateChanged(this._onBusyStateChanged);

                // List report template model
                // let oTemplateModel = this.oView.getModel("_templPriv").getData();

                let oMassApproveBtn = this.oView.byId(this._sIdPrefix + "approveSSDRs");
                // Bind button enables based on default approve functionality
                oMassApproveBtn.bindProperty("enabled", {
                    path: "_templPriv>/generic/controlProperties/action::cds_zcs_grpl.cds_zcs_grpl_Entities::approve/enabled"
                });
            },

            onInitSmartFilterBarExtension: function (oEvent) {
                this.oSmartFilterBar = oEvent.getSource();
                if (this.oSmartFilterBar.isInitialised()) {
                    this.oSmartFilterBar.setLiveMode(true);
                }
                /* Code for setting up default values for date filters
                var oToday = new Date();
                 var oDefaultFilter = {
                     "ValidTo": {
                         "ranges": [{
                             "exclude": false,
                             "operation": "GE",
                             "keyField": "ValidTo",
                             "value1": oToday,
                             "value2": null
                         }]
                     },
                     "ValidFrom": {
                         "ranges": [{
                             "exclude": false,
                             "operation": "LE",
                             "keyField": "ValidTo",
                             "value1": oToday,
                             "value2": null,
                         }]
                     }
                 };
                  this.oSmartFilterBar.setFilterData(oDefaultFilter);*/
            },
            /**
             * Method for adjusting table widths based on text 
             * @param {*} oEvent 
             */
            _onBusyStateChanged: function (oEvent) {
                var bBusy = oEvent.getParameter("busy");
                if (!bBusy && !this._bColumnOptimizationDone) {
                    var oTable = oEvent.getSource();
                    var oTpc = null;
                    if (sap.ui.table.TablePointerExtension) {
                        oTpc = new sap.ui.table.TablePointerExtension(oTable);
                    } else {
                        oTpc = new sap.ui.table.extensions.Pointer(oTable);
                    }
                    var aColumns = oTable.getColumns();
                    for (var i = aColumns.length; i >= 0; i--) {
                        oTpc.doAutoResizeColumn(i);
                    }
                    //This line can be commented if you want the columns to be adjusted on every scroll
                    this._bColumnOptimizationDone = true;
                }

            },
            getCustomAppStateDataExtension: function (oCustomData) {
                //the content of the custom field will be stored in the app state, so that it can be restored later, for example after a back navigation.
                //The developer has to ensure that the content of the field is stored in the object that is passed to this method.
                if (oCustomData) {
                    var oConfidentialField = this.oView.byId("IsConfidentialID");
                    if (oConfidentialField) {
                        oCustomData.IsConfidential = oConfidentialField.getSelectedKey();
                    }
                }
            },
            restoreCustomAppStateDataExtension: function (oCustomData) {
                //in order to restore the content of the custom field in the filter bar, for example after a back navigation,
                //an object with the content is handed over to this method. Now the developer has to ensure that the content of the custom filter is set to the control
                if (oCustomData) {
                    if (oCustomData.IsConfidential) {
                        var oConfidentialField = this.oView.byId("IsConfidentialID");
                        oConfidentialField.setSelectedKey(
                            oCustomData.IsConfidential
                        );
                    }
                }
            },
            onBeforeRebindTableExtension: function (oEvent) {
                var oBindingParams = oEvent.getParameter("bindingParams");
                oBindingParams.parameters = oBindingParams.parameters || {};
                var oSmartTable = oEvent.getSource();
                var oSmartFilterBar = this.byId(oSmartTable.getSmartFilterId());
                if (oSmartFilterBar instanceof SmartFilterBar) {
                    var oConfidentialFilter = oSmartFilterBar.getControlByKey("IsConfidential");

                    if (oConfidentialFilter instanceof ComboBox) {
                        var sConfidential = oConfidentialFilter.getSelectedKey();
                        if (sConfidential) {
                            oBindingParams.filters.push(new Filter("IsConfidential", "EQ", sConfidential));
                        }
                    }
                }
            },
            /**
             * =============== Mass Change of Prices ==============
             * This feature enables the mass change of SPR, Acc. Cal. Value, Check Base Price with percentage 
             */
            /**
             * Method to open the Mass Change Prices dialog 
             */
            onOpenMassChangePricesDialog: function () {
                Fragment.load({
                    name: "com.rs.cf.grplservicedocumentrecord.ext.fragments.MassChangePriceDialog",
                    controller: this
                }).then(function (oFragment) {
                    this.oMassChangePricesDialog = oFragment;
                    this.getView().addDependent(this.oMassChangePricesDialog);
                    this.oMassChangePricesDialog.setEscapeHandler(function () {
                        this.onCloseMassChangePricesDialog();
                    }.bind(this));
                    var aSelectedContexts = this._getSelectedBindingContexts(this.oGridTable);
                    this.oMassChangePricesDialog.getContent()[0].setContexts(aSelectedContexts);

                    this.oMassChangePricesDialog.open();
                }.bind(this));
            },
            /**
             * Method to close the mass change of rices dialog
             */
            onCloseMassChangePricesDialog: function () {
                this.oMassChangePricesDialog.close();
            },
            /**
             *  =============== Mass Approval of SDR ==============
             */
            /**
           * Method to open the Mass aproval loading dialog 
           */
            onOpenMassApprovalDialog: function () {
                if (!this.oMassApprovalDialog) {
                    this.oMassApprovalDialog = Fragment.load({
                        name: "com.rs.cf.grplservicedocumentrecord.ext.fragments.MassApproval",
                        controller: this
                    }).then(function (oMassApprovalDialog) {
                        this.getView().addDependent(oMassApprovalDialog);

                        return oMassApprovalDialog;
                    }.bind(this));
                }

                this.oMassApprovalDialog.then(function (oMassApprovalDialog) {
                    this.oAppModel.setProperty("/ApproveLoaderStatus", "None");
                    this.oAppModel.setProperty("/ApproveLoader", 1);

                    oMassApprovalDialog.open();
                    this.onMassApprove();
                }.bind(this));
            },
            /**
             * Custom method to approve big ammount of SDRs
             * Is recommended to have less then 50 req in a batch to avoid timeout
             * With this method the request are chunked based on size and send in different batches 
             * @param {*} oEvent 
             */
            onMassApprove: function (oEvent) {
                let that = this;
                let aSDRApproveGroups = [];
                let aErrorMessages = [];
                let aSelectedContexts = this._getSelectedBindingContexts(this.oGridTable);
                var aSDRs = aSelectedContexts.map((c) => {
                    return c.getObject();
                }, [])
                // Prepare chuncks and batch requests
                let iChunkMaxSize = 30;
                let iChunkSize = Math.min(iChunkMaxSize, aSDRs.length)
                let aApprovalChunks = this._chunkArray(aSDRs, iChunkSize);
                aApprovalChunks.forEach((chunk, index) => {
                    //Batch deffered group for approving SDR data 
                    let sGroup = "SDRApproveGroup" + index;
                    that.oDataModel.setDeferredGroups(that.oDataModel.getDeferredGroups().concat([sGroup]));
                    aSDRApproveGroups.push(sGroup);

                    for (const property in chunk) {
                        let sdr = chunk[property];
                        let mParameters = {
                            UUID: sdr.UUID,
                            IsActiveEntity: sdr.IsActiveEntity
                        }
                        if (sdr.DocumentStatus === "02") {
                            that.oDataModel.callFunction("/approve", {
                                urlParameters: mParameters,
                                method: "POST",
                                batchGroupId: sGroup,
                                success: function () { },
                                error: function (oError) {
                                    aErrorMessages.push(sdr.DeviceType + ": " + (JSON.parse(oError.responseText)).error.message.value)

                                }
                            });
                        }
                    }

                })
                // Process batches
                that.submitBatchGroups(aSDRApproveGroups).then(() => {
                    that.oAppModel.setProperty("/ApproveLoaderStatus", "Success");
                    that.oAppModel.setProperty("/ApproveLoader", 100);
                    that.oGridTable.getAggregation("plugins")[0].removeSelectionInterval(0, that.oGridTable._iBindingLength);
                    that.oMassApprovalDialog.then(function (oBusyDialog) {
                        setTimeout(() => {
                            oBusyDialog.close();
                            that.oDataModel.refresh();
                            if (aErrorMessages.length > 0) {
                                MessageBox.error(that.oTranslationBundle.getText("NotProcessedText") +
                                    aErrorMessages.join('\n\n'), {
                                    title: that.oTranslationBundle.getText("Error"),
                                    contentWidth: "40%",
                                });
                            }
                        }, "2000");
                    });

                })
            },

            /*
            * ================= XLXS Uploads common functions ===============
            * Uploads are handle via external library spreadsheetimporter (https://spreadsheet-importer.com/)
            */
            /**
             * Function for transforming the uploaded data
             * @param {*} oUploadEventPayload aUploadErrors
             * @returns null
             */
            processAndMapUploadedData: function (oUploadEventPayload) {
                return new Promise(function (resolve, reject) {
                    let aServiceOptionsAvailableKeys = ['CAL-ACC', 'CAL-APERF', 'ADJUST', 'ACCADJUST', 'EXAM',
                        'CAL-MAN', 'MINOR-REPAIR', 'CAL-MVA', 'CAL-MVP', 'CAL-PERF', 'CHK-PERF',
                        'SPR', 'SPR-ACC', 'SPR-BASIC', 'SPRB-EXCAL', 'SPRB-ACC', 'SPR-EXCAL',
                        'CAL-ACA', 'WE1', 'WE2', 'WE3', 'WE4', 'R1', 'R2', 'R3', 'R4', 'R5',
                        'CC2', 'CC3', 'CC4', 'CC5', 'C1', 'C2', 'C3', 'C4', 'C5',
                        'CW1', 'CW2', 'CW3', 'CW4', 'RC1', 'RC2', 'RC3', 'RC4', 'RC5',
                        'AW1', 'AW2', 'AW3', 'AW4', 'AC2', 'AC3', 'AC4', 'AC5', 'AR1', 'AR2', 'AR3', 'AR4', 'AR5',
                        'A1', 'A2', 'A3', 'A4', 'A5', 'P1', 'P2', 'P3', 'P4', 'P5'];

                    let aSDRFieldsToProcess = ['Valid From', 'SPR', 'Cal./Prf. Check Base Price'];


                    oUploadEventPayload.forEach((uploadItem) => {
                        //Process uploaded data in this.oProcessedUploadedData
                        let sMatNo = uploadItem['Material No.'] && uploadItem['Material No.'].rawValue !== 0 ? uploadItem['Material No.'].rawValue : "";
                        let sConfiguration = uploadItem['Configuration'] && uploadItem['Configuration'].rawValue !== 0 ? uploadItem['Configuration'].rawValue : "";
                        let sCalibrationInterval = uploadItem['Calibration Interval'] && uploadItem['Calibration Interval'].rawValue !== 0 ? uploadItem['Calibration Interval'].rawValue : "";
                        let sWarrantyInterval = uploadItem['Warranty Interval'] && uploadItem['Warranty Interval'].rawValue !== 0 ? uploadItem['Warranty Interval'].rawValue : "";

                        let sSDRpath = sMatNo + ',' + sConfiguration + "," + sCalibrationInterval + "," + sWarrantyInterval;
                        let oFilter = new sap.ui.model.Filter({
                            filters: [
                                new Filter("DeviceMaterialNo", FilterOperator.EQ, sMatNo),
                                new Filter("ConfigLong", FilterOperator.EQ, sConfiguration),
                                new Filter("CalibrationInterval", FilterOperator.EQ, sCalibrationInterval),
                                new Filter("WarrantyInterval", FilterOperator.EQ, sWarrantyInterval),
                                new Filter("HasRevision", FilterOperator.EQ, false),
                                new Filter("IsGlobal", FilterOperator.EQ, true)
                            ],
                            and: true
                        });
                        if (!this.oProcessedUploadedData[sSDRpath]) {
                            this.oProcessedUploadedData[sSDRpath] = {
                                SDRPath: sSDRpath,
                                SDRFilter: undefined,
                                SOKeysToUpdate: [],
                                SOToUpdate: {},
                                KeysToUpdate: []
                            };
                        }
                        this.oProcessedUploadedData[sSDRpath]["SDRFilter"] = oFilter;

                        // Check if are prices columns to be processed
                        aServiceOptionsAvailableKeys.forEach((key) => {
                            let price = uploadItem['Price[' + key + ']'] && uploadItem['Price[' + key + ']'] !== 0 ? uploadItem['Price[' + key + ']'].rawValue : undefined;
                            if (price) {
                                this.oProcessedUploadedData[sSDRpath]["SOToUpdate"][key] = price;
                                this.oProcessedUploadedData[sSDRpath]["SOKeysToUpdate"].push(key);
                            }
                        });
                        // Check if are SDR fields columns to be processed
                        aSDRFieldsToProcess.forEach((key) => {
                            let rawValue = uploadItem[key] && uploadItem[key] !== 0 ? uploadItem[key].rawValue : undefined;
                            if (rawValue) {
                                let technicalProp;
                                switch (key) {
                                    case 'Valid From':
                                        technicalProp = "ValidFrom"
                                        this.oProcessedUploadedData[sSDRpath][technicalProp] = new Date(rawValue);
                                        break;
                                    case 'SPR': // Draft
                                        technicalProp = "StandardPriceRepair";
                                        this.oProcessedUploadedData[sSDRpath][technicalProp] = rawValue.toString();
                                        break;
                                    case 'Cal./Prf. Check Base Price':
                                        technicalProp = "PerfCheckBasePrice";
                                        this.oProcessedUploadedData[sSDRpath][technicalProp] = rawValue.toString();
                                        break;
                                    default:
                                        // Do nothing
                                        break;
                                }

                                this.oProcessedUploadedData[sSDRpath]["KeysToUpdate"].push(technicalProp);
                            }
                        });
                        if (this.oSDRReadRequests.indexOf(this.oProcessedUploadedData[sSDRpath]) === -1) {
                            this.oSDRReadRequests.push(this.oProcessedUploadedData[sSDRpath]);
                        }

                    });

                    resolve();
                }.bind(this))

            },
            /**
             * Generic method to submit an array batch groups
             * @param {*} aGroups 
             * @returns 
             */
            submitBatchGroups: function (aGroups) {
                let that = this;
                let iCount = 0;
                let aResponseData = [];
                return new Promise(function (resolve, reject) {
                    aGroups.forEach((group) => {
                        that.oDataModel.submitChanges({
                            groupId: group,
                            success: function (oData) {
                                iCount++;
                                if (oData.__batchResponses) {
                                    oData.__batchResponses.forEach((batchResponse) => {
                                        if (batchResponse.data && batchResponse.data.results.length > 0) {
                                            aResponseData.push(batchResponse.data.results[0])
                                        }
                                    })
                                }
                                if (iCount === aGroups.length) {
                                    resolve(aResponseData);
                                }
                            },
                            error: function (oError) {
                                iCount++;
                                jQuery.sap.log.error("Error while submitting group", group);

                            }
                        })
                    })
                })

            },
            createServiceOptionPriceUpdateReq: function (sGroup, oServiceOption, oPayload) {
                let that = this;
                that.oDataModel.update("/ServiceOption(UUID=guid'" + oServiceOption.UUID + "',IsActiveEntity=" + oServiceOption.IsActiveEntity + ")", oPayload, {
                    method: "PUT",
                    groupId: sGroup,
                    success: function (oData) { },
                    error: function (oError) {
                        that.aUploadErrors.push(oServiceOption.ServiceMaterial + "-" + oServiceOption.ServiceKey + ": " + (JSON.parse(oError.responseText)).error.message.value);
                    }
                });
            },
            createUpdatePriceBaseReq: function (sGroup, oData, oPayload) {
                let that = this;
                let sUpdateRevisionGroup = sGroup + "updaterevision";
                that.oDataModel.setDeferredGroups(that.oDataModel.getDeferredGroups().concat([sUpdateRevisionGroup]));
                that.aUpdatePriceBaseGroups.push(sUpdateRevisionGroup);

                that.oDataModel.update("/ServiceDocument(UUID=guid'" + oData.UUID + "',IsActiveEntity=" + oData.IsActiveEntity + ")", oPayload, {
                    method: "POST",
                    batchGroupId: sUpdateRevisionGroup,
                    success: function () { },
                    error: function (oError) {
                        that.aUploadErrors.push(oData.DeviceType + ": " + (JSON.parse(oError.responseText)).error.message.value);
                    }
                });
            },
            createCalculateServicesReq: function (sGroup, oData) {
                let that = this;
                let sCalculatePricesGroup = sGroup + "calculateServices";
                that.oDataModel.setDeferredGroups(that.oDataModel.getDeferredGroups().concat([sCalculatePricesGroup]));
                that.aCalculatesPricesGroups.push(sCalculatePricesGroup);
                that.oDataModel.callFunction("/calcServicePrice", {
                    urlParameters: {
                        UUID: oData.UUID,
                        IsActiveEntity: oData.IsActiveEntity,
                    },
                    method: "POST",
                    batchGroupId: sCalculatePricesGroup,
                    success: function (oData) { },
                    error: function (oError) { }
                });
            },
            createSendToApprovalReq: function (sGroup, oData) {
                let that = this;
                let sSendToApprovalGroup = sGroup + "sendToApproval";
                that.oDataModel.setDeferredGroups(that.oDataModel.getDeferredGroups().concat([sSendToApprovalGroup]));
                that.aSendToApprovalGroups.push(sSendToApprovalGroup);

                that.oDataModel.callFunction("/sendToApproval", {
                    urlParameters: {
                        UUID: oData.UUID,
                        IsActiveEntity: oData.IsActiveEntity,
                    },
                    method: "POST",
                    batchGroupId: sSendToApprovalGroup,
                    success: function () { },
                    error: function () { }
                });
            },
            createReworkNeededReq: function (sGroup, oData) {
                let that = this;
                let sReworkNeededGroup = sGroup + "reworkNedeed";
                that.oDataModel.setDeferredGroups(that.oDataModel.getDeferredGroups().concat([sReworkNeededGroup]));
                that.aReworkNeededGroups.push(sReworkNeededGroup);
                that.oDataModel.callFunction("/reworkNedeed", {
                    urlParameters: {
                        UUID: oData.UUID,
                        IsActiveEntity: oData.IsActiveEntity,
                    },
                    method: "POST",
                    batchGroupId: sReworkNeededGroup,
                    success: function (oData) { },
                    error: function (oError) { }
                });
            },

            /**
            *  =============== Mass Upload Prices (xlsx) ==============
            * This code will upload the a new price in the Manual Price of the Service Options of a SDR(s)
            * Fot this feature external library is used to process the excel data: https://spreadsheet-importer.com/
            */
            /**
            * Method to trigger open of spreadsheetimporter dialog
            */
            onOpenSpreadsheetMassUploadPrices: async function () {
                this.oProcessedUploadedData = {};
                this.oSDRReadRequests = [];

                this.spreadsheetUploadManualPrice = await this.oView
                    .getController()
                    .getOwnerComponent()
                    .createComponent({
                        usage: "spreadsheetImporter",
                        async: true,
                        componentData: {
                            context: this,
                            standalone: true,
                            readAllSheets: true,
                            showBackendErrorMessages: false,
                            hidePreview: true
                        }
                    });
                this.spreadsheetUploadManualPrice.attachUploadButtonPress(function (oEvent) {
                    // Prevent data from being sent to the backend
                    oEvent.preventDefault();
                    // Get payload
                    const payload = oEvent.getParameter("payload");
                    this.onOpenMassUploadPricesIndicatorDialog(payload);

                }, this);

                this.spreadsheetUploadManualPrice.openSpreadsheetUploadDialog();

            },
            /**
             * Method for opening the dialog indicator for Mass Upload Prices (xlsx)
             * @param {*} oUploadEventPayload 
             */
            onOpenMassUploadPricesIndicatorDialog: function (oUploadEventPayload) {
                if (!this.oMassUploadPricesIndicatorDialog) {
                    this.oMassUploadPricesIndicatorDialog = Fragment.load({
                        name: "com.rs.cf.grplservicedocumentrecord.ext.fragments.MassUploadPricesIndicator",
                        controller: this
                    }).then(function (oMassUploadPricesIndicatorDialog) {
                        this.getView().addDependent(oMassUploadPricesIndicatorDialog);

                        return oMassUploadPricesIndicatorDialog;
                    }.bind(this));
                }

                this.oMassUploadPricesIndicatorDialog.then(function (oMassUploadPricesIndicatorDialog) {
                    this.oAppModel.setProperty("/CheckServiceLoaderStatus", "None");
                    this.oAppModel.setProperty("/CheckServiceLoader", 1);
                    this.oAppModel.setProperty("/RevisionCreationLoaderText", "Revisions");
                    this.oAppModel.setProperty("/RevisionCreationLoaderStatus", "None");
                    this.oAppModel.setProperty("/RevisionCreationLoader", 1);
                    this.oAppModel.setProperty("/UploadPricesLoaderText", "Prices");
                    this.oAppModel.setProperty("/UploadPricesLoaderStatus", "None");
                    this.oAppModel.setProperty("/UploadPricesLoader", 1);
                    oMassUploadPricesIndicatorDialog.open();

                    this.processMassUploadPrices(oUploadEventPayload);
                }.bind(this));
            },
            /**
             * Method for preparing all the batch requests
             * This is done in chunks(of 50), due to the fact that several batches has to done
             * @param {*} SDRReadChunks 
             * @returns 
             */
            processMassUploadPricesChunks: function (SDRReadChunks) {
                let that = this;
                this.aUploadErrors = []; // collect all the upload errors
                this.aSDRGroups = []; // collect all groups for Read SDR batches 
                this.aRevGroups = []; // collect all groups for Create Revisions batches 
                this.aReadRevGroups = []; // collect all groups for Read Revisions batches (we need in order to retrieve the revisions Service Options) 
                this.aPriceGroups = []; // collect all groups for Update Service Options ManualPrice batches 
                this.aSendToApprovalGroups = []; // collect all groups for SendToApproval batches 

                return new Promise(function (resolveChunk, rejectChunk) {
                    SDRReadChunks.forEach((chunk, index) => {
                        //Batch deffered group for reading SDR data 
                        let sGroup = "SDRChunkedGroup" + index;
                        that.oDataModel.setDeferredGroups(that.oDataModel.getDeferredGroups().concat([sGroup]));
                        that.aSDRGroups.push(sGroup);
                        for (const property in chunk) {
                            let item = chunk[property];
                            let sSDRpath = item.SDRPath;
                            let aKeysToUpdate = item["SOKeysToUpdate"];
                            let aServOptToUpdate = item["SOToUpdate"];
                            // Check if there are Service Options to update
                            if (aKeysToUpdate.length > 0)
                                that.oDataModel.read("/ServiceDocument", {
                                    method: "GET",
                                    filters: [item.SDRFilter],
                                    urlParameters: {
                                        "$expand": "to_ServiceOption",
                                        "$select": "UUID,DeviceType,DocumentStatus,IsActiveEntity,to_ServiceOption"
                                    },
                                    groupId: sGroup,
                                    success: function (oData) {
                                        let serviceDoc = oData.results[0];
                                        if (serviceDoc) {
                                            switch (serviceDoc.DocumentStatus) {
                                                case '03': // Approved
                                                    that.uploadManualPricesForApprovedSDR(sSDRpath, serviceDoc, sGroup);
                                                    break;
                                                case '02': // Ready for approval
                                                case '01': // Draft
                                                case '08': // Rework Needed
                                                    let aSvailableSDRServOpt = serviceDoc.to_ServiceOption.results;

                                                    let sUploadPriceGroup = "UpdatePriceGroup" + serviceDoc.DeviceType;
                                                    that.oDataModel.setDeferredGroups(that.oDataModel.getDeferredGroups().concat([sUploadPriceGroup]));
                                                    that.aPriceGroups.push(sUploadPriceGroup);

                                                    aSvailableSDRServOpt.forEach((availableSDRSO) => {
                                                        let newPrice = parseFloat(aServOptToUpdate[availableSDRSO.ServiceKey]);
                                                        let currentPrice = parseFloat(availableSDRSO.ManualPrice);
                                                        if (aKeysToUpdate.includes(availableSDRSO.ServiceKey) && newPrice && newPrice !== currentPrice) {
                                                            //Batch for update price in Service Options
                                                            let oSOPayload = {
                                                                "ManualPrice": newPrice.toString(),
                                                                "Currency": "EUR"
                                                            }
                                                            that.createServiceOptionPriceUpdateReq(sUploadPriceGroup, availableSDRSO, oSOPayload);
                                                        }

                                                    })
                                                    if (serviceDoc.DocumentStatus !== "02") {
                                                        that.createSendToApprovalReq(sGroup, serviceDoc);
                                                    }
                                                    break;
                                                default:
                                                    console.log(`Document Status not allowed ${serviceDoc.DocumentStatus}.`);
                                                    break;
                                            }
                                        }

                                    },
                                    error: function (oError) { }
                                });

                        }
                    })
                    resolveChunk();

                })
            },

            /**
             * Method to load the data in GRPL, based on the batch requests
             * @param {*} oUploadEventPayload 
             */
            processMassUploadPrices: async function (oUploadEventPayload) {
                let that = this;
                let iStartLoader = 5;
                let iFinishLoader = 100;
                // Start Reading SDR(s)
                this.oAppModel.setProperty("/CheckServiceLoaderStatus", "Information");
                this.oAppModel.setProperty("/CheckServiceLoader", iStartLoader);
                this.oAppModel.setProperty("/CheckServiceLoaderText", this.oTranslationBundle.getText("CheckServiceLoaderTextStart"));

                this.processAndMapUploadedData(oUploadEventPayload)
                    .then(() => {
                        this.oAppModel.setProperty("/CheckServiceLoaderText", Object.keys(this.oProcessedUploadedData).length + " " + this.oTranslationBundle.getText("CheckServiceLoaderTextCheckServices"));
                        let iChunkMaxSize = 30; // max size of requests in a batch
                        let iChunkSize = Math.min(iChunkMaxSize, this.oSDRReadRequests.length) // if request are less then iChunkMaxSize, take the number if req
                        let SDRReadChunks = this._chunkArray(this.oSDRReadRequests, iChunkSize);
                        this.processMassUploadPricesChunks(SDRReadChunks)
                            .then(() => {
                                // Submit sdr read request
                                that.submitBatchGroups(that.aSDRGroups).then((oResponse) => {
                                    that.oAppModel.setProperty("/CheckServiceLoaderText", oResponse.length + " " + that.oTranslationBundle.getText("CheckServiceLoaderTextFoundServices"));
                                    that.oAppModel.setProperty("/CheckServiceLoader", iFinishLoader);
                                    that.oAppModel.setProperty("/CheckServiceLoaderStatus", "Success");
                                    if (that.aRevGroups.length > 0) { // Check if revisions have to be created
                                        that.oAppModel.setProperty("/RevisionCreationLoader", iStartLoader);
                                        that.oAppModel.setProperty("/RevisionCreationLoaderText", that.oTranslationBundle.getText("RevisionCreationLoaderTextStart"));
                                        that.oAppModel.setProperty("/RevisionCreationLoaderStatus", "Information");
                                        // Submit creating revisions requests
                                        that.submitBatchGroups(that.aRevGroups).then(() => {
                                            // Submit read revisions service options requests
                                            that.submitBatchGroups(that.aReadRevGroups).then(() => {
                                                that.oAppModel.setProperty("/RevisionCreationLoader", iFinishLoader);
                                                that.oAppModel.setProperty("/RevisionCreationLoaderText", that.oTranslationBundle.getText("RevisionCreationLoaderTextRevisionSuccess"));
                                                that.oAppModel.setProperty("/RevisionCreationLoaderStatus", "Success");
                                                if (that.aPriceGroups.length > 0) { // Check if are prices to be updated
                                                    that.oAppModel.setProperty("/UploadPricesLoaderText", that.oTranslationBundle.getText("UploadPricesLoaderTextStart"));
                                                    that.oAppModel.setProperty("/UploadPricesLoader", iStartLoader);
                                                    that.oAppModel.setProperty("/UploadPricesLoaderStatus", "Information");
                                                    // Submit update service options price requests
                                                    that.submitBatchGroups(that.aPriceGroups).then(() => {
                                                        if (that.aSendToApprovalGroups.length > 0) { // Check if there are sdr(s) to send for approval
                                                            //Submit send to aproval requests
                                                            that.submitBatchGroups(that.aSendToApprovalGroups).then(() => {
                                                                that.oAppModel.setProperty("/UploadPricesLoader", iFinishLoader);
                                                                that.oAppModel.setProperty("/UploadPricesLoaderStatus", "Success");
                                                                that.refreshAfterMassUploadPrices();
                                                            });
                                                        } else {
                                                            that.oAppModel.setProperty("/UploadPricesLoader", iFinishLoader);
                                                            that.oAppModel.setProperty("/UploadPricesLoaderStatus", "Success");
                                                            that.refreshAfterMassUploadPrices();
                                                        }

                                                    });
                                                } else {
                                                    that.oAppModel.setProperty("/UploadPricesLoaderStatus", "None");
                                                    that.oAppModel.setProperty("/UploadPricesLoaderStatusText", that.oTranslationBundle.getText("UploadPricesLoaderTextNoPricesToUpload"));
                                                    that.refreshAfterMassUploadPrices();
                                                }
                                            });

                                        });
                                    } else {
                                        that.oAppModel.setProperty("/RevisionCreationLoaderText", that.oTranslationBundle.getText("RevisionCreationLoaderTextNoRevisionToCreate"));
                                        that.oAppModel.setProperty("/UploadPricesLoaderText", that.oTranslationBundle.getText("UploadPricesLoaderTextStart"));
                                        if (that.aPriceGroups.length > 0) { // Check if are prices to be updated
                                            that.oAppModel.setProperty("/UploadPricesLoaderText", that.oTranslationBundle.getText("UploadPricesLoaderTextStart"));
                                            that.oAppModel.setProperty("/UploadPricesLoader", iStartLoader);
                                            that.oAppModel.setProperty("/UploadPricesLoaderStatus", "Information");
                                            // Submit update service options price requests
                                            that.submitBatchGroups(that.aPriceGroups).then(() => {
                                                if (that.aSendToApprovalGroups.length > 0) { // Check if there are sdr(s) to send for approval
                                                    //Submit send to aproval requests
                                                    that.submitBatchGroups(that.aSendToApprovalGroups).then(() => {
                                                        that.oAppModel.setProperty("/UploadPricesLoader", iFinishLoader);
                                                        that.oAppModel.setProperty("/UploadPricesLoaderStatus", "Success");
                                                        that.refreshAfterMassUploadPrices();
                                                    });
                                                } else {
                                                    that.oAppModel.setProperty("/UploadPricesLoader", iFinishLoader);
                                                    that.oAppModel.setProperty("/UploadPricesLoaderStatus", "Success");
                                                    that.refreshAfterMassUploadPrices();
                                                }

                                            });
                                        } else {
                                            that.oAppModel.setProperty("/UploadPricesLoaderStatus", "None");
                                            that.oAppModel.setProperty("/UploadPricesLoaderStatusText", that.oTranslationBundle.getText("UploadPricesLoaderTextNoPricesToUpload"));
                                            that.refreshAfterMassUploadPrices();
                                        }
                                    }

                                });
                            })

                    }, this);

            },
            /**
            * 
            * @param {*} sSDRPath 
            * @param {*} serviceDoc 
            * @param {*} sGroup 
            */
            uploadManualPricesForApprovedSDR: function (sSDRPath, serviceDoc, sGroup) {
                let that = this;
                let mRevisionParameters = {
                    UUID: serviceDoc.UUID,
                    IsActiveEntity: serviceDoc.IsActiveEntity,
                };
                let sRevisionGroup = sGroup + "Revision";
                that.oDataModel.setDeferredGroups(that.oDataModel.getDeferredGroups().concat([sRevisionGroup]));
                that.aRevGroups.push(sRevisionGroup);

                // Batch for create revision
                that.oDataModel.callFunction("/createRevision", {
                    urlParameters: mRevisionParameters,
                    method: "POST",
                    batchGroupId: sRevisionGroup,
                    success: function (oRevisionData) {
                        let sReadRevisionGroup = sGroup + "ReadRevision";
                        that.oDataModel.setDeferredGroups(that.oDataModel.getDeferredGroups().concat([sReadRevisionGroup]));
                        that.aReadRevGroups.push(sReadRevisionGroup);
                        //Batch for read revision's Service Options
                        that.oDataModel.read("/ServiceDocument(UUID=guid'" + oRevisionData.UUID + "',IsActiveEntity=" + oRevisionData.IsActiveEntity + ")/to_ServiceOption", {
                            method: "GET",
                            urlParameters: {
                                "$select": "UUID,IsActiveEntity,ServiceKey,ServiceMaterial,ManualPrice"
                            },
                            batchGroupId: sReadRevisionGroup,
                            success: function (oData) {
                                let oRevisionServiceOptions = oData.results;
                                if (that.oProcessedUploadedData[sSDRPath]) {
                                    let aKeysToUpdate = that.oProcessedUploadedData[sSDRPath]["SOKeysToUpdate"];
                                    let aServOptToUpdate = that.oProcessedUploadedData[sSDRPath]["SOToUpdate"];
                                    let sUploadPricesGroup = "UpdatePricesGroup" + oRevisionData.UUID;
                                    that.oDataModel.setDeferredGroups(that.oDataModel.getDeferredGroups().concat([sUploadPricesGroup]));
                                    that.aPriceGroups.push(sUploadPricesGroup);
                                    oRevisionServiceOptions.forEach((revSO) => {
                                        let newPrice = parseFloat(aServOptToUpdate[revSO.ServiceKey]);
                                        let currentPrice = parseFloat(revSO.ManualPrice);
                                        if (aKeysToUpdate.includes(revSO.ServiceKey) && newPrice && newPrice !== currentPrice) {
                                            //Batch for update price in Service Options
                                            let oSOPayload = {
                                                "ManualPrice": newPrice.toString(),
                                                "Currency": "EUR"
                                            }
                                            that.createServiceOptionPriceUpdateReq(sUploadPricesGroup, revSO, oSOPayload);
                                        }
                                    })

                                    that.createSendToApprovalReq(sGroup, oRevisionData);
                                } else {
                                    console.log(`Doc Path not found in uploaded item ${sSDRPath}.`);
                                }
                            },
                            error: function (oError) { }
                        });
                    }
                });

            },
            /**
             * Method to close Mass Upload Prices Dialog Indicator, reload data and display error if there are  
             */
            refreshAfterMassUploadPrices: function () {
                let that = this;
                that.oMassUploadPricesIndicatorDialog.then(function (oBusyDialog) {
                    setTimeout(() => {
                        oBusyDialog.close();
                        that.oDataModel.refresh();
                        if (that.aUploadErrors.length > 0) {
                            MessageBox.error(that.oTranslationBundle.getText("NotProcessedText") +
                                that.aUploadErrors.join('\n\n'), {
                                title: that.oTranslationBundle.getText("Error"),
                                contentWidth: "40%",
                            });
                        }
                    }, "2000");
                });
            },


            /**
            *  =============== Mass Upload Price Base (.xlsx) ==============
            * Uploads are handle via external library spreadsheetimporter (https://spreadsheet-importer.com/)
            */
            /**
             * Method to trigger open of spreadsheetimporter dialog
             */
            onOpenSpreadsheetMassUploadPriceBase: async function () {
                this.oProcessedUploadedData = {};
                this.oSDRReadRequests = [];


                this.spreadsheetMassUploadPriceBase = await this.oView
                    .getController()
                    .getOwnerComponent()
                    .createComponent({
                        usage: "spreadsheetImporter",
                        async: true,
                        componentData: {
                            context: this,
                            standalone: true,
                            readAllSheets: true,
                            hideSampleData: false,
                            activateDraft: true,
                            showBackendErrorMessages: false,
                            hidePreview: true,
                            }
                    });
                this.spreadsheetMassUploadPriceBase.attachUploadButtonPress(function (oEvent) {
                    // Prevent data from being sent to the backend
                    oEvent.preventDefault();
                    // Get payload
                    const payload = oEvent.getParameter("payload");
                    this.onOpenMassUploadPriceBaseIndicatorDialog(payload);

                }, this);

                this.spreadsheetMassUploadPriceBase.openSpreadsheetUploadDialog();
            },
            /**
             * 
             * @param {*} oUploadEventPayload 
             */
            onOpenMassUploadPriceBaseIndicatorDialog: function (oUploadEventPayload) {
                if (!this.oMassUploadPriceBaseIndicatorDialog) {
                    this.oMassUploadPriceBaseIndicatorDialog = Fragment.load({
                        name: "com.rs.cf.grplservicedocumentrecord.ext.fragments.MassUploadPriceBaseIndicator",
                        controller: this
                    }).then(function (oMassUploadPriceBaseIndicatorDialog) {
                        this.getView().addDependent(oMassUploadPriceBaseIndicatorDialog);

                        return oMassUploadPriceBaseIndicatorDialog;
                    }.bind(this));
                }

                this.oMassUploadPriceBaseIndicatorDialog.then(function (oMassUploadPriceBaseIndicatorDialog) {
                    this.oAppModel.setProperty("/CheckServiceLoaderStatus", "None");
                    this.oAppModel.setProperty("/CheckServiceLoader", 1);
                    this.oAppModel.setProperty("/RevisionCreationLoaderText", "Create Revisions");
                    this.oAppModel.setProperty("/RevisionCreationLoaderStatus", "None");
                    this.oAppModel.setProperty("/RevisionCreationLoader", 1);
                    this.oAppModel.setProperty("/UploadPriceBaseLoaderText", "Update Price Base");
                    this.oAppModel.setProperty("/UploadPriceBaseLoaderStatus", "None");
                    this.oAppModel.setProperty("/UploadPriceBaseLoader", 1);
                    oMassUploadPriceBaseIndicatorDialog.open();

                    this.processMassUploadPriceBase(oUploadEventPayload);
                }.bind(this));
            },
            /**
             * Method for preparing all the batch requests
             * This is done in chunks(of 50), due to the fact that several batches has to done
             * @param {*} SDRReadChunks 
             * @returns 
             */
            processMassUploadPriceBaseChunks: function (SDRReadChunks) {
                let that = this;
                this.aUploadErrors = [];
                this.aSDRGroups = [];
                this.aRevGroups = [];
                this.aReworkNeededGroups = [];
                this.aUpdatePriceBaseGroups = [];
                this.aCalculatesPricesGroups = [];
                this.aSendToApprovalGroups = [];

                return new Promise(function (resolveChunk, rejectChunk) {
                    SDRReadChunks.forEach((chunk, index) => {
                        let sGroup = "SDRChunkedGroup" + index;
                        that.oDataModel.setDeferredGroups(that.oDataModel.getDeferredGroups().concat([sGroup]));
                        that.aSDRGroups.push(sGroup);

                        for (const property in chunk) {
                            let item = chunk[property];
                            let sSDRPath = item.SDRPath;
                            let aKeysToUpdate = item["KeysToUpdate"];
                            // Check if there items to update
                            if (aKeysToUpdate.length > 0) {
                                that.oDataModel.read("/ServiceDocument", {
                                    method: "GET",
                                    filters: [item.SDRFilter],
                                    urlParameters: {
                                        "$select": "UUID,DeviceType,DocumentStatus,IsActiveEntity"
                                    },
                                    groupId: sGroup,
                                    success: function (oData) {
                                        let serviceDoc = oData.results[0];
                                        let oUpdatePriceBasePayload = {
                                            "Currency": "EUR"
                                        };
                                        if (serviceDoc) {
                                            switch (serviceDoc.DocumentStatus) {
                                                case '03': // Approved
                                                    that.uploadPriceBaseForApprovedSDR(sSDRPath, serviceDoc, sGroup);
                                                    break;
                                                case '02': // Ready for approval
                                                    that.createReworkNeededReq(sGroup, serviceDoc)
                                                    aKeysToUpdate.forEach((key) => {
                                                        oUpdatePriceBasePayload[key] = that.oProcessedUploadedData[sSDRPath][key];
                                                    })
                                                    that.createUpdatePriceBaseReq(sGroup, serviceDoc, oUpdatePriceBasePayload);
                                                    that.createCalculateServicesReq(sGroup, serviceDoc);
                                                    that.createSendToApprovalReq(sGroup, serviceDoc);
                                                    break;
                                                case '01': // Draft
                                                case '08': // Rework Needed
                                                    aKeysToUpdate.forEach((key) => {
                                                        oUpdatePriceBasePayload[key] = that.oProcessedUploadedData[sSDRPath][key];
                                                    })
                                                    that.createUpdatePriceBaseReq(sGroup, serviceDoc, oUpdatePriceBasePayload);
                                                    that.createCalculateServicesReq(sGroup, serviceDoc);
                                                    that.createSendToApprovalReq(sGroup, serviceDoc);

                                                    break;
                                                default:
                                                    console.log(`Document Status not allowed ${serviceDoc.DocumentStatus}.`);
                                                    break;
                                            }
                                        }

                                    },
                                    error: function (oError) { }
                                });
                            }
                        }

                    })
                    resolveChunk();

                })
            },
            /**
             * 
             * @param {*} oUploadEventPayload 
             */
            processMassUploadPriceBase: function (oUploadEventPayload) {
                let that = this;
                let iStartLoader = 5;
                let iFinishLoader = 100;

                // Start Reading SDR(s)
                this.oAppModel.setProperty("/CheckServiceLoaderStatus", "Information");
                this.oAppModel.setProperty("/CheckServiceLoader", iStartLoader);
                this.oAppModel.setProperty("/CheckServiceLoaderText", this.oTranslationBundle.getText("CheckServiceLoaderTextStart"));

                this.processAndMapUploadedData(oUploadEventPayload)
                    .then(() => {
                        this.oAppModel.setProperty("/CheckServiceLoaderText", Object.keys(this.oProcessedUploadedData).length + " " + this.oTranslationBundle.getText("CheckServiceLoaderTextCheckServices"));
                        let maxChunckSize = 30;
                        let minChunkSize = Math.min(maxChunckSize, this.oSDRReadRequests.length)
                        let SDRReadChunks = this._chunkArray(this.oSDRReadRequests, minChunkSize);
                        this.processMassUploadPriceBaseChunks(SDRReadChunks)
                            .then(() => {
                                // Submit sdr read request
                                that.submitBatchGroups(that.aSDRGroups).then((oResponse) => {
                                    that.oAppModel.setProperty("/CheckServiceLoaderText", oResponse.length + " " + that.oTranslationBundle.getText("CheckServiceLoaderTextFoundServices"));
                                    that.oAppModel.setProperty("/CheckServiceLoader", iFinishLoader);
                                    that.oAppModel.setProperty("/CheckServiceLoaderStatus", "Success");
                                    if (that.aRevGroups.length > 0) { // Check if revisions have to be created
                                        that.oAppModel.setProperty("/RevisionCreationLoader", iStartLoader);
                                        that.oAppModel.setProperty("/RevisionCreationLoaderText", that.oTranslationBundle.getText("RevisionCreationLoaderTextStart"));
                                        that.oAppModel.setProperty("/RevisionCreationLoaderStatus", "Information");
                                        // Submit creating revisions requests
                                        that.submitBatchGroups(that.aRevGroups).then(() => {
                                            if (that.aUpdatePriceBaseGroups.length > 0) { // Check if there are price base data to be updated
                                                // Submit update price base request
                                                that.submitBatchGroups(that.aUpdatePriceBaseGroups).then(() => {
                                                    that.oAppModel.setProperty("/UploadPriceBaseLoaderStatus", "Success");
                                                    that.oAppModel.setProperty("/UploadPriceBaseLoaderText", that.oTranslationBundle.getText("UploadPriceBaseLoaderTextSuccess"));
                                                    // Submit calculate price request
                                                    that.submitBatchGroups(that.aCalculatesPricesGroups).then(() => {
                                                        // Submit send to approval request
                                                        that.submitBatchGroups(that.aSendToApprovalGroups).then(() => {
                                                            that.refreshAfterMassUploadPriceBase();
                                                        });
                                                    });
                                                });
                                            }
                                        });
                                    } else {
                                        that.oAppModel.setProperty("/RevisionCreationLoaderText", that.oTranslationBundle.getText("RevisionCreationLoaderTextNoRevisionToCreate"));
                                        that.oAppModel.setProperty("/UploadPriceBaseLoaderText", that.oTranslationBundle.getText("UploadPriceBaseLoaderTextStart"));
                                        that.oAppModel.setProperty("/UploadPriceBaseLoader", iStartLoader);
                                        that.oAppModel.setProperty("/UploadPriceBaseLoaderStatus", "Information")
                                        if (that.aReworkNeededGroups.length > 0) {
                                            // Submit rework needed requests
                                            that.submitBatchGroups(that.aReworkNeededGroups).then(() => {
                                                if (that.aUpdatePriceBaseGroups.length > 0) { // Check if there are price base data to be updated
                                                    // Submit update price base request
                                                    that.submitBatchGroups(that.aUpdatePriceBaseGroups).then(() => {
                                                        that.oAppModel.setProperty("/UploadPriceBaseLoaderStatus", "Success");
                                                        that.oAppModel.setProperty("/UploadPriceBaseLoaderText", that.oTranslationBundle.getText("UploadPriceBaseLoaderTextSuccess"));
                                                        // Submit calculate price request
                                                        that.submitBatchGroups(that.aCalculatesPricesGroups).then(() => {
                                                            // Submit send to approval request
                                                            that.submitBatchGroups(that.aSendToApprovalGroups).then(() => {
                                                                that.refreshAfterMassUploadPriceBase();
                                                            });
                                                        });
                                                    });
                                                }
                                            });
                                        } else {
                                            if (that.aUpdatePriceBaseGroups.length > 0) { // Check if there are price base data to be updated
                                                that.oAppModel.setProperty("/UploadPriceBaseLoaderStatus", "Success");
                                                that.oAppModel.setProperty("/UploadPriceBaseLoaderText", that.oTranslationBundle.getText("UploadPriceBaseLoaderTextSuccess"));
                                                // Submit update price base request
                                                that.submitBatchGroups(that.aUpdatePriceBaseGroups).then(() => {
                                                    // Submit calculate price request
                                                    that.submitBatchGroups(that.aCalculatesPricesGroups).then(() => {
                                                        // Submit send to approval request
                                                        that.submitBatchGroups(that.aSendToApprovalGroups).then(() => {
                                                            that.refreshAfterMassUploadPriceBase();
                                                        });
                                                    });
                                                });
                                            } else {
                                                that.refreshAfterMassUploadPriceBase();
                                            }
                                        }
                                    }

                                });
                            })


                    }, this)

            },
            /**
            * @param {*} sSDRPath 
            * @param {*} serviceDoc 
            * @param {*} sGroup 
            */
            uploadPriceBaseForApprovedSDR: function (sSDRPath, oServiceDoc, sGroup) {
                let that = this;
                let mRevisionParameters = {
                    UUID: oServiceDoc.UUID,
                    IsActiveEntity: oServiceDoc.IsActiveEntity,
                };
                let sRevisionGroup = sGroup + "Revision";
                that.oDataModel.setDeferredGroups(that.oDataModel.getDeferredGroups().concat([sRevisionGroup]));
                that.aRevGroups.push(sRevisionGroup);

                // Batch for create revision
                that.oDataModel.callFunction("/createRevision", {
                    urlParameters: mRevisionParameters,
                    method: "POST",
                    batchGroupId: sRevisionGroup,
                    success: function (oRevisionData) {
                        let aKeysToUpdate = that.oProcessedUploadedData[sSDRPath]["KeysToUpdate"];
                        let oUpdateRevisionPayload = {
                            "Currency": "EUR"
                        };
                        aKeysToUpdate.forEach((key) => {
                            oUpdateRevisionPayload[key] = that.oProcessedUploadedData[sSDRPath][key];
                        })
                        that.createUpdatePriceBaseReq(sGroup, oRevisionData, oUpdateRevisionPayload);
                        that.createCalculateServicesReq(sGroup, oRevisionData);
                        that.createSendToApprovalReq(sGroup, oRevisionData);

                    }
                });

            },
            refreshAfterMassUploadPriceBase: function () {
                let that = this;
                that.oMassUploadPriceBaseIndicatorDialog.then(function (oBusyDialog) {
                    setTimeout(() => {
                        oBusyDialog.close();
                        that.oDataModel.refresh();
                        if (that.aUploadErrors.length > 0) {
                            MessageBox.error(that.oTranslationBundle.getText("NotProcessedText") +
                                that.aUploadErrors.join('\n\n'), {
                                title: that.oTranslationBundle.getText("Error"),
                                contentWidth: "40%",
                            });
                        }
                    }, "2000");
                });
            },

            /*
             * ================= Utility functions =====================
             **/
            /**
            * 
            * @param {*} array - big array that has to be chunked 
            * @param {*} chunkSize - maximum length of each chunk (array)
            * @returns chunks - array of chunks 
            */
            _chunkArray: function (array, chunkSize) {
                const chunksLength = array.length / chunkSize;
                const chunks = Array.from({ length: chunksLength }, (_) => []);
                array.forEach((value, index) => {
                    chunks[index % chunks.length].push(value);
                });
                return chunks;
            },
            /**
             * Gets the binding contexts for the selected table rows.
             * @private
             * @param {sap.ui.table.Table} oTable - the table get the binding contexts from
             * @returns {Array} an array of binding contexts
             */
            _getSelectedBindingContexts: function (oTable) {
                return oTable.getAggregation("plugins")[0].getSelectedIndices().map(function (iSelectedIndex) {
                    return oTable.getContextByIndex(iSelectedIndex);
                });
            }
        };
    });
