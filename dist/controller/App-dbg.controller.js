sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "../model/formatter",
    "sap/m/Text",
    "sap/m/Button",
    "sap/m/Dialog",
    "sap/m/MessageView",
    "sap/m/MessageItem",
    "sap/ui/core/Fragment",
    "sap/ui/core/BusyIndicator",
  ],
  function (
    BaseController,
    MessageBox,
    formatter,
    Text,
    Button,
    Dialog,
    MessageView,
    MessageItem,
    Fragment,
    BusyIndicator

  ) {
    "use strict";

    var oData;

    return BaseController.extend("com.karsan.qm.sapmaportali.controller.App", {

      formatter: formatter,

      onInit: function () {
        oData = this.getOwnerComponent().getModel();
        oData.setSizeLimit(1000000);
      },

      getModel: function (sPath) {
        return this.getView().getModel(sPath);
      },

      getViewModel: function () {
        return this.getView().getModel("viewModel");
      },

      getRouter: function () {
        return this.getOwnerComponent().getRouter();
      },

      getText(vCode) {
        let oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
        return oResourceBundle.getText(vCode);
      },

      showErrorMessageBox(vCode) {
        MessageBox.error(this.getText(vCode));
      },

      // onShowBusyIndicator and onHideBusyIndicator
      confirmAction(sMessage, oParent, iDescriptionMode = 1, oAddContent) {
        let that = this;
        return new Promise(function (resolve) {
          let oViewModel = that.getViewModel();
          let sDescription = "";
 
          let aContent = [];
          aContent.push(new sap.m.VBox({
            items: [
              new Text({ text: sMessage }),
              oAddContent
            ]
          }));

          if (iDescriptionMode === 2 || iDescriptionMode === 3 || iDescriptionMode === 4) {

            that._sRequired = false;
            if (iDescriptionMode === 4) {
              that._sRequired = oViewModel.getProperty("/CopyByCancel");
            } else {
              that._sRequired = iDescriptionMode === 3;
            }

            const oTextArea = new sap.m.TextArea({
              id: "IdConfirmActionDescription",
              placeholder: that.getText("EnterDescription"),
              maxLength: 500,
              rows: 4,
              width: "100%",
              required: that._sRequired,
              valueStateText: that.getText("Max500Chars"),
              liveChange: function (oEvent) {
                sDescription = oEvent.getParameter("value");
              }
            });

            aContent.push(new sap.m.VBox({
              items: [
                new sap.m.Label({
                  text: that.getText("DescriptionLabel"),
                  required: that._sRequired
                }),
                oTextArea
              ]
            }));
          }

          var oDialog = new Dialog({
            title: that.getText("AreYouSure"),
            type: "Message",
            state: "Warning",
            content: aContent,
            beginButton: new Button({
              text: that.getText("Yes"),
              type: "Emphasized",
              press: function () {
                // Description zorunluysa ve boşsa hata göster
                if (that._sRequired && !sDescription.trim()) {
                  let oTAParenInd = oDialog.getContent().length - 1;
                  let oTA = oDialog.getContent()[oTAParenInd]
                    ?.getItems().find(i => i.isA("sap.m.TextArea"));
                  if (oTA) {
                    oTA.setValueState("Error");
                    oTA.setValueStateText(that.getText("DescriptionRequired"));
                  }
                  return;
                }
                oDialog.close();
                resolve({
                  confirmed: true,
                  description: sDescription
                });
              }
            }),
            endButton: new Button({
              text: that.getText("Cancel"),
              type: "Reject",
              press: function () {
                oDialog.close();
                resolve({
                  confirmed: false,
                  description: ""
                });
              }
            }),
            afterClose: function () {
              oDialog.destroy();
            }
          });
          that.getView().addDependent(oDialog);
          oDialog.open();
        });
      },

      readEntity: function (sPath, mParameters = {}) {
        return new Promise(function (resolve, reject) {
          oData.read("/" + sPath, {
            urlParameters: mParameters.urlParameters || {},
            success: function (oData) {
              resolve(oData);
            },
            error: function (oError) {
              reject(oError);
            }
          });
        });
      },

      readEntitySet: function (sEntitySetName, mParameters = {}) {
        return new Promise(function (resolve, reject) {
          oData.read("/" + sEntitySetName, {
            filters: mParameters.filters || [],
            urlParameters: mParameters.urlParameters || {},
            success: function (oData) {
              resolve(oData);
            },
            error: function (oError) {
              reject(oError);
            }
          });
        });
      },

      _showMessage: function (aPassed) {

        aPassed = Array.isArray(aPassed) ? aPassed : (aPassed ? [aPassed] : []);
        let aExist = this.getViewModel().getProperty("/Messages") || [];
        let aMessages = this._formatMessage([...aExist, ...aPassed]);

        this.getViewModel().setProperty("/Messages", aMessages);
        this.getViewModel().refresh(true);

        if (!aMessages || aMessages.length === 0) { return; }

        const oMessageView = new MessageView();
        oMessageView.setModel(this.getViewModel(), "viewModel");
        oMessageView.unbindAggregation("items");

        oMessageView?.attachActiveTitlePress(function (oEvent) {
          const oItem = oEvent.getParameter("item");
          if (oItem) {
            const sControlId = oItem.getBindingContext("viewModel").getProperty("controlId");
            if (sControlId) {
              const oControl = this.getView().byId(sControlId);
              if (oControl) {
                oControl.focus();

                if (sControlId.startsWith("IdTab")) {
                  const sTabId = sControlId.replace("IdTab", "");
                  const oTabBar = this.getView().byId("IdTabBar");
                  if (oTabBar) {
                    oTabBar.setSelectedKey(sTabId);
                  }
                }

                if (oControl.setValueState) {
                  oControl.setValueState("Error");
                }
                this.onCloseDMessages();
              }
            }
          }
        }.bind(this));

        oMessageView.bindAggregation("items", {
          model: "viewModel",
          path: "/Messages",
          templateShareable: false,
          template: new MessageItem({
            type: "{viewModel>type}",
            title: "{viewModel>title}",
            subtitle: "{viewModel>subtitle}",
            description: "{viewModel>description}",
            groupName: "{viewModel>groupName}",
            activeTitle: "{viewModel>activeTitle}",
          })
        });

        this._oDMessages = new Dialog({
          title: this.getText("DMessagesTitle") || "Mesajlar",
          type: "Message",
          contentWidth: "50%",
          contentHeight: "40%",
          resizable: true,
          draggable: true,
          state: "Information",
          content: [oMessageView],
          endButton: new Button({
            text: this.getText("Close") || "Kapat",
            press: function () { this.onCloseDMessages(); }.bind(this)
          }),
          afterOpen: function () {
            const $mv = oMessageView.$();
            if ($mv && $mv.length) {
              const winH = window.innerHeight || $(window).height();
              const desired = Math.max(200, Math.round(winH * 0.6) - 120);
              $mv.css({ height: desired + "px", overflow: "auto" });
            }
          }
        });
        this.getView().addDependent(this._oDMessages);
        this._oMessageView = oMessageView;

        setTimeout(function () {
          // this._setValueStateByMessages();
          this._oDMessages.open();
        }.bind(this), 0);
      },

      _setValueStateByMessages: function () {
        let aMessages = this.getViewModel().getProperty("/Messages") || [];
        aMessages.forEach(oMessage => {
          if (oMessage.controlId && oMessage.type === "Error") {
            this.getView().byId(oMessage.controlId)?.setValueState("Error");
          }
        });
      },

      onCloseDMessages: function () {
        this._clearMessages();
        if (this._oDMessages) {
          this._oDMessages.close();
        }
        let aAction = this.getViewModel().getProperty("/WaitingAction") || [];
        aAction.sort((a, b) => a.seqnr - b.seqnr);
        aAction.forEach(oAction => {
          eval(`${oAction.function}(oAction.event)`);
        });
        this.getViewModel().setProperty("/WaitingAction", []);
      },

      _formatMessage: function (data) {
        if (!Array.isArray(data)) {
          data = [data];
        }
        const mapType = t => {
          if (!t) { return "None"; }
          switch (t) {
            case "S": return "Success";
            case "W": return "Warning";
            case "E": return "Error";
            case "A": return "Error";
            case "X": return "Error";
            case "I": return "Information";
            default: return t;
          }
        };
        const seen = new Set();
        const out = [];
        if (!Array.isArray(data)) { return out; }
        data.forEach(e => {
          const desc = (e.description || e.Message || e.message || "").toString();
          if (!desc) { return; }
          if (seen.has(desc)) { return; }
          seen.add(desc);
          const item = {
            type: e.type || mapType(e.Type) || "None",
            title: (e.title || desc).toString(),
            subtitle: (e.subtitle || e.Id + e.Number || "").toString(),
            description: desc,
            groupName: (e.groupName || "").toString(),
            activeTitle: e.activeTitle || false,
            controlId: e.controlId || null
          };
          out.push(item);
        });
        return out;
      },

      _addMessage: function (oMessage) {
        let aMsg = this._formatMessage(oMessage);
        let aMessages = this.getViewModel().getProperty("/Messages") || [];
        aMsg.forEach(newMsg => {
          const exists = aMessages.some(existingMsg => existingMsg.description === newMsg.description);
          if (!exists) {
            aMessages.push(newMsg);
          }
        });
        this.getViewModel().setProperty("/Messages", aMessages);
      },

      _checkMessagesHasError: function () {
        let aMessages = this.getViewModel().getProperty("/Messages") || [];
        return aMessages.some(msg => msg.type === "Error");
      },

      _clearMessages: function () {
        this.getViewModel().setProperty("/Messages", []);
      },

      getCurrentTimeEdmFormat() {
        const now = new Date();
        const ms = now.getHours() * 3600000 + now.getMinutes() * 60000 + now.getSeconds() * 1000;
        return {
          ms: ms,
          __edmType: "Edm.Time"
        };
      },

      createDialog(sFragmentName) {
        return new Promise((fnResolve) => {
          Fragment.load({
            id: this.getView().getId(),
            name: `com.karsan.qm.servisbulten.view.fragment.Dialog.${sFragmentName}`,
            controller: this
          }).then(oFragment => {
            this.getView().addDependent(oFragment);
            fnResolve(oFragment);
          });
        });
      },

      /* ==== */
      /* CRUD */
      /* ==== */

      onCallFunction(sEntity, sMethod, oModel, oURLParameters) {
        return new Promise((fnResolve, fnReject) => {
          const mParameters = {
            method: sMethod,
            urlParameters: oURLParameters,
            success: fnResolve,
            error: fnReject
          };
          oModel.callFunction(sEntity, mParameters);
        });
      },

      onCreate(sSet, oData, oModel) {
        return new Promise((fnSuccess, fnReject) => {
          const mParameters = {
            success: fnSuccess,
            error: fnReject
          };
          oModel.create(sSet, oData, mParameters);
        });
      },

      onDelete(sSet, oModel) {
        return new Promise((fnSuccess, fnReject) => {
          const mParameters = {
            success: fnSuccess,
            error: fnReject
          };
          oModel.remove(sSet, mParameters);
        });
      },

      onRead(sSet, oModel) {
        return new Promise((fnSuccess, fnReject) => {
          const mParameters = {
            success: fnSuccess,
            error: fnReject
          };
          oModel.read(sSet, mParameters);
        });
      },

      onReadAssociation(sSet, oExpand, oModel) {
        return new Promise((fnSuccess, fnReject) => {
          const mParameters = {
            urlParameters: oExpand,
            success: fnSuccess,
            error: fnReject
          };
          oModel.read(sSet, mParameters);
        });
      },

      onReadExpanded(sSet, aFilters, oExpand, oModel) {
        return new Promise((fnSuccess, fnReject) => {
          const mParameters = {
            filters: aFilters,
            urlParameters: oExpand,
            success: fnSuccess,
            error: fnReject
          };
          oModel.read(sSet, mParameters);
        });
      },

      onReadQuery(sSet, aFilters, oModel) {
        return new Promise((fnSuccess, fnReject) => {
          const mParameters = {
            filters: aFilters,
            success: fnSuccess,
            error: fnReject
          };
          oModel.read(sSet, mParameters);
        });
      },

      onReadQueryAsyncSorters(sSet, aFilters, bAsync, aSorters, oModel) {
        return new Promise((fnSuccess, fnReject) => {
          const mParameters = {
            async: bAsync,
            filters: aFilters,
            sorters: aSorters,
            success: fnSuccess,
            error: fnReject
          };
          oModel.read(sSet, mParameters);
        });
      },

      onReadQueryParameters(sSet, aFilters, oModel, oURLParameters) {
        return new Promise((fnSuccess, fnReject) => {
          const mParameters = {
            filters: aFilters,
            urlParameters: oURLParameters,
            success: fnSuccess,
            error: fnReject
          };
          oModel.read(sSet, mParameters);
        });
      },

      onSubmitChanges(oModel) {
        return new Promise((fnSuccess, fnReject) => {
          const mParameters = {
            success: fnSuccess,
            error: fnReject
          };
          oModel.submitChanges(mParameters);
        });
      },

      onUpdate(sSet, oData, oModel) {
        return new Promise((fnSuccess, fnReject) => {
          const mParameters = {
            success: fnSuccess,
            error: fnReject
          };
          oModel.update(sSet, oData, mParameters);
        });
      },

    });
  }
);
