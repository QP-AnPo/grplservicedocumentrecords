sap.ui.define([],
    function () {
        "use strict";
        return {
            onInit: async function (oEvent) {
                this.oView = this.getView();
                this.oDataModel = this.getOwnerComponent().getModel();

                if (!this._sIdPrefix) {
                    this._sIdPrefix =
                        "com.rs.cf.grplservicedocumentrecord::sap.suite.ui.generic.template.ObjectPage.view.Details::ServiceDocument--";
                }
                var oServiceOptionsSmartTable = this.oView.byId(this._sIdPrefix + "to_ServiceOption::com.sap.vocabularies.UI.v1.LineItem::Table")
                var oServiceOptionsTable = this.oView.byId(this._sIdPrefix + "to_ServiceOption::com.sap.vocabularies.UI.v1.LineItem::responsiveTable")
                if (oServiceOptionsTable) {
                    oServiceOptionsTable.setGrowingThreshold(100);

                }
                oServiceOptionsSmartTable.attachAfterVariantApply((oEvent) => {
                    let oSource = oEvent.getSource();
                    if (oSource.getCurrentVariantId() === "") {
                        var oBinding = oServiceOptionsTable.getBinding("items");
                        var oSorter = new sap.ui.model.Sorter("ServiceGrp", false, true);
                        if (oBinding) {
                            oBinding.sort(oSorter);
                        }

                    }
                })

                oServiceOptionsTable.attachEventOnce("updateFinished", function () {
                    var oBinding = oServiceOptionsTable.getBinding("items");
                    var oSorter = new sap.ui.model.Sorter("ServiceGrp", false, true);
                    if (oBinding) {
                        oBinding.sort(oSorter);
                    }

                });
                this.extensionAPI.attachPageDataLoaded(function (oEvent) {
                    //this.oContextObj = oEvent.context.getObject();
                    this.sPath = oEvent.context.getPath();
                    this.oContextObj = this.oDataModel.getProperty(this.sPath);
                    this.setMinDateOfValidityDates();
                    this.setConfigurationLayout();
                    this._reloadData();
                }.bind(this));

                this.oDataModel.attachBatchRequestCompleted(function () {
                    if (this.sPath) {
                        this.oContextObj = this.oDataModel.getProperty(this.sPath);
                        this.adjustServiceTable();
                        this.setConfigurationLayout();
                    }
                }.bind(this));

            },
            adjustServiceTable: function () {
                this.oServiceOptionsTable = this.oView.byId(this._sIdPrefix + "to_ServiceOption::com.sap.vocabularies.UI.v1.LineItem::Table").getTable();
                if (this.oServiceOptionsTable && this.oContextObj) {
                    this.oServiceOptionsTable.removeSelections();
                    if (this.oContextObj.IsTPM) {
                        this.oServiceOptionsTable.setGrowingThreshold(5);
                    } else {
                        this.oServiceOptionsTable.setGrowingThreshold(72);
                    }
                    var oActivateServiceBtn = this.oView.byId(this._sIdPrefix + "to_ServiceOption::com.sap.vocabularies.UI.v1.LineItem::action::cds_zcs_grpl.cds_zcs_grpl_Entities::activateServOpt");
                    var oDeactivateServiceBtn = this.oView.byId(this._sIdPrefix + "to_ServiceOption::com.sap.vocabularies.UI.v1.LineItem::action::cds_zcs_grpl.cds_zcs_grpl_Entities::deactivateServOpt");
                    if (this.oContextObj.DocumentStatus === '03' || this.oContextObj.DocumentStatus === '09' || this.oContextObj.DocumentStatus === '02') {
                        this.oServiceOptionsTable.setMode("None");
                        if (oActivateServiceBtn) oActivateServiceBtn.setVisible(false);
                        if (oDeactivateServiceBtn) oDeactivateServiceBtn.setVisible(false);
                    } else {
                        this.oServiceOptionsTable.setMode("MultiSelect");
                        if (oActivateServiceBtn) oActivateServiceBtn.setVisible(true);
                        if (oDeactivateServiceBtn) oDeactivateServiceBtn.setVisible(true);
                    }
                }

            },
            setMinDateOfValidityDates: async function () {
                let oValidFromField = this.oView.byId(this._sIdPrefix + "com.sap.vocabularies.UI.v1.FieldGroup::General::ValidFrom::Field");
                let oValidToField = this.oView.byId(this._sIdPrefix + "com.sap.vocabularies.UI.v1.FieldGroup::General::ValidTo::Field");
                const today = new Date();
                const prevDocValidFrom = new Date(this.oContextObj.ValidFrom);
                const minDate = prevDocValidFrom && prevDocValidFrom > today ? prevDocValidFrom : today
                oValidFromField.attachContextEditableChanged(function (oEvent) {
                    let oValidFromDatePicker = this.oView.byId(this._sIdPrefix + "com.sap.vocabularies.UI.v1.FieldGroup::General::ValidFrom::Field-datePicker");
                    if (oValidFromDatePicker) {
                        oValidFromDatePicker.setMinDate(minDate);
                    }
                }.bind(this));

                oValidToField.attachContextEditableChanged(function (oEvent) {
                    let oValidToDatePicker = this.oView.byId(this._sIdPrefix + "com.sap.vocabularies.UI.v1.FieldGroup::General::ValidTo::Field-datePicker");
                    if (oValidToDatePicker) {
                        console.error("this.oContextObj.ValidFrom", this.oContextObj.ValidFrom, minDate);
                        oValidToDatePicker.setMinDate(this.oContextObj.ValidFrom);
                    }
                }.bind(this));
            },

            setConfigurationLayout: function () {
                if (this.oContextObj) {
                    var oDeviceTypeField = this.getField("General", "DeviceType");
                    var oBaseMaterialField = this.getField("General", "BaseMaterial");
                    var oConfigLongField = this.getField("General", "ConfigLong");
                    var oConfigMaterialField = this.getField("General", "DeviceConfigMaterialNo");
                    var oManufacturerMaterialNoField = this.getField("General", "ManufacturerMaterialNo");

                    if (oDeviceTypeField) {
                        oDeviceTypeField.setMandatory(true)
                        oDeviceTypeField.setEditable(!this.oContextObj.IsRevision);
                    }
                    if (oBaseMaterialField) {
                        oBaseMaterialField.setVisible(!this.oContextObj.IsTPM);
                    }
                    if (oManufacturerMaterialNoField) {
                        oManufacturerMaterialNoField.setEditable(!this.oContextObj.IsRevision);
                        oManufacturerMaterialNoField.setVisible(this.oContextObj.IsTPM);
                    }
                    if (oConfigMaterialField) {
                        oConfigMaterialField.setVisible(this.oContextObj.IsDeviceConfigurable);
                    }
                    if (oConfigLongField) {
                        oConfigLongField.setMandatory(true)
                        oConfigLongField.setEditable(!this.oContextObj.IsRevision);
                        oConfigLongField.setVisible(this.oContextObj.IsDeviceConfigurable);
                    }
                }
            },
            getField: function (sGroup, sField) {
                return this.oView.byId(this._sIdPrefix + "com.sap.vocabularies.UI.v1.FieldGroup::" + sGroup + "::" + sField + "::Field");
            },
            onExit: function () {
                this.oDataModel.detachBatchRequestCompleted();
                this.extensionAPI.detachPageDataLoaded();
            },
            _reloadData: function () {
                var that = this;
                that.oDataModel.read(this.sPath, {
                    async: true,
                    urlParameters: {
                        "$expand": "to_ServiceOption"
                    },
                    success: function (oData) {

                    },
                    error: function (oError) {
                        console.error(oError);
                    }
                });
            }
        };
    }.bind(this));
