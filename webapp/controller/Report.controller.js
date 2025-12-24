sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "../model/formatter",
        "sap/ui/core/BusyIndicator",
        "sap/m/MessageBox",
        "sap/ushell/Container",
    ],
    function (
        Controller,
        formatter,
        BusyIndicator,
        MessageBox,
        ShellCont,
    ) {
        "use strict";

        var oData = {};

        return Controller.extend("com.karsan.qm.sapmaportali.controller.Report", {
            formatter: formatter,
            onInit() {
                oData = this.getOwnerComponent().getModel();
                oData.setSizeLimit(1000000);

                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.getRoute("Report").attachMatched(this._onRouteMatched, this);
            },

            _onRouteMatched: function () {
                this.getOwnerComponent().getModel().metadataLoaded().then(async () => {
                    await this._getUserInformation();

                    let sLoggedInUser = ShellCont.getUser().getId().toUpperCase();
                    const sUserPath = oData.createKey("/UserSet", { Uname: sLoggedInUser });
                    const oUser = await this.onRead(sUserPath, oData);
                    this.getViewModel().setProperty("/LoggedUser", oUser);

                    await this.onInitFilter();
                });
            },

            onInitFilter: async function (oEvent) {
                let oUser = this.getViewModel().getProperty("/LoggedUser");
                let oFbLifnr = this.byId("idSfbReportSet").getControlByKey("Lifnr");
                if (oUser.IsSupplier) {
                    oFbLifnr.setValue(oUser.Uname);
                    oFbLifnr.setEnabled(false);
                }
            },

            onSelectNotif(oEvent) {
                var vSelQmnum = oEvent.getParameter("rowBindingContext").getObject().Qmnum;
                return this.getOwnerComponent().getRouter().navTo("Notif", { Qmnum: vSelQmnum });
            },

            onNewNotif() {
                return this.getOwnerComponent().getRouter().navTo("Notif", { Qmnum: "&1" });
            },

            // BTP Workzone User Info 
            _getUserInformation: async function () {
                return new Promise((resolve, reject) => {
                    if (window.top === window) {
                        resolve(); // Standalone mode ise de çık
                        return;
                    }

                    BusyIndicator.show();

                    this._readBtpWorkzoneId()
                        .then((oResult) => {
                            const sBTPWorkzoneID = oResult.BtpWorkzoneID || oResult.BtpLinkID || oResult.BtpLink || "";

                            let oIntervalID;
                            const fnHandleMessage = async (oEvent) => {
                                if (oEvent.origin !== sBTPWorkzoneID) return;

                                try {
                                    const oData = JSON.parse(oEvent.data);
                                    if (oData?.RequestID === "UserMailRequest" && oData.UserMail) {
                                        clearInterval(oIntervalID);
                                        window.removeEventListener("message", fnHandleMessage);

                                        await this._verifySupplierEmail(oData.UserMail);
                                        BusyIndicator.hide();
                                        resolve(); // ✅ Success
                                    }
                                } catch (err) {
                                    clearInterval(oIntervalID);
                                    window.removeEventListener("message", fnHandleMessage);
                                    this._rejectInvalidUserAccess(fnHandleMessage, oIntervalID);
                                    reject(err); // ✅ Error
                                }
                            };

                            window.addEventListener("message", fnHandleMessage);
                            oIntervalID = setInterval(() => {
                                window.top.postMessage(
                                    JSON.stringify({
                                        RequestID: "UserMailRequest"
                                    }),
                                    sBTPWorkzoneID
                                );
                            }, 3000);
                        })
                        .catch((error) => {
                            BusyIndicator.hide();
                            this._rejectInvalidUserAccess();
                            reject(error); // ✅ Error
                        });
                });
            },

            _readBtpWorkzoneId: function (sEmail) {
                const oModel = this.getOwnerComponent().getModel("btpService");
                return new Promise((resolve, reject) => {
                    oModel.read(`/BtpLinkSet('OWN')`, {
                        success: resolve,
                        error: reject
                    });
                });
            },

            _verifySupplierEmail: async function (sEmail) {
                try {
                    const oUserData = await this._readUserByEmail(sEmail);
                    this.getView().getModel().setHeaders({
                        email: sEmail
                    });
                    return oUserData; // ✅ Promise resolve
                } catch (err) {
                    this._rejectInvalidUserAccess();
                    throw err; // ✅ Promise reject
                }
            },

            _readUserByEmail: function (sEmail) {
                const oModel = this.getOwnerComponent().getModel("btpService");
                return new Promise((resolve, reject) => {
                    oModel.read(`/SupplierLogonInfoSet('${sEmail}')`, {
                        success: resolve,
                        error: reject
                    });
                });
            },

            _rejectInvalidUserAccess: function (fnHandleMessage, oIntervalID) {
                BusyIndicator.hide();
                if (oIntervalID) clearInterval(oIntervalID);
                if (fnHandleMessage) window.removeEventListener("message", fnHandleMessage);

                let vErrorTxt = this.getView().getModel("i18n").getProperty("AuthSupplierNotFound");
                MessageBox.error(vErrorTxt, {
                    actions: [MessageBox.Action.CLOSE],
                    onClose: () => {
                        history.go(-1);
                    }
                });
            },

            getViewModel: function () {
                return this.getView().getModel("viewModel");
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

        });
    });
