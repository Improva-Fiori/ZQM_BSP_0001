sap.ui.define(
    [
        "../controller/App.controller",
        "sap/m/MessageBox",
        "sap/ui/model/json/JSONModel",
        "../model/formatter",
        "sap/ui/core/BusyIndicator",
        "sap/m/ColumnListItem",
        "sap/m/Label",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/ui/table/Column",
        "sap/m/Column",
        "sap/m/Text",
        "sap/ui/core/library",
        "sap/m/MessageItem",
        "sap/m/MessageView",
        "sap/m/Button",
        "sap/m/Dialog",
        "sap/m/Bar",
        "sap/m/Title",
        "sap/ui/core/IconPool",
        'sap/ui/core/Core',
        "sap/m/library",
        "sap/m/MessageToast",
        "sap/m/TextArea",
        "sap/ushell/Container",
        "sap/ui/core/format/DateFormat",
        'sap/ui/core/Fragment',
        "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
        "sap/ui/comp/filterbar/FilterBar",
        "sap/ui/comp/filterbar/FilterGroupItem",
        "sap/m/Input",
        "sap/m/List",
        "sap/m/VBox",
        "sap/m/Popover",

    ],
    function (
        Controller,
        MessageBox,
        JSONModel,
        formatter,
        BusyIndicator,
        ColumnListItem,
        Label,
        Filter,
        FilterOperator,
        UIColumn,
        MColumn,
        Text,
        coreLibrary,
        MessageItem,
        MessageView,
        Button,
        Dialog,
        Bar,
        Title,
        IconPool,
        Core,
        mobileLibrary,
        MessageToast,
        TextArea,
        ShellCont,
        DateFormat,
        Fragment,
        ValueHelpDialog,
        FilterBar,
        FilterGroupItem,
        Input,
        List,
        VBox,
        Popover
    ) {
        "use strict";

        var TitleLevel = coreLibrary.TitleLevel,
            ButtonType = mobileLibrary.ButtonType,
            DialogType = mobileLibrary.DialogType,
            ValueState = coreLibrary.ValueState,
            oData = {};

        var _SHRefQmnum,
            _SHSasi,
            _SHLifnr,
            _SHMatnr,
            _SHAprvr;

        return Controller.extend("com.karsan.qm.sapmaportali.controller.Notif", {
            formatter: formatter,
            onInit() {
                oData = this.getOwnerComponent().getModel();
                oData.setSizeLimit(1000000);

                this.getRouter().getRoute("Notif").attachMatched(this._onRouteMatched, this);
            },

            _onRouteMatched(oEvent) {
                this.getOwnerComponent().getModel().metadataLoaded().then(async () => {
                    try {
                        await this._getUserInformation();
                        this._setInitModel();
                        let vQmnum = oEvent.getParameter("arguments").Qmnum;
                        this._loadNotif(vQmnum);
                    } catch (error) {
                        return this._rejectInvalidUserAccess();
                    }
                });
            },

            async _loadNotif(vQmnum) {
                try {
                    BusyIndicator.show();
                    let sLoggedInUser = ShellCont.getUser().getId().toUpperCase();
                    const sUserPath = oData.createKey("/UserSet", { Uname: sLoggedInUser });
                    const oLogged = await this.onRead(sUserPath, oData);
                    this.getViewModel().setProperty("/LoggedUser", oLogged);

                    let sHeaderPath = oData.createKey("/HeaderSet", { Qmnum: vQmnum });
                    const oExpand = {
                        "$expand": "Flow,Vehicle,Comment,CurrentApr"
                    };
                    const oNotifData = await this.onReadExpanded(sHeaderPath, [], oExpand, oData);
                    let hasAuth = await this._checkNotifAuth(oNotifData.Qmnum);
                    if (hasAuth) {
                        this.setNotifDataToView(oNotifData);
                    }
                } catch (error) {
                } finally {
                    BusyIndicator.hide();
                }
            },

            async _checkNotifAuth(sQmnum) {
                if (sQmnum === "INVALID" || sQmnum.includes('UNAUTH')) {
                    BusyIndicator.hide();
                    MessageBox.error(this.getText(sQmnum + "SPM"), {
                        actions: [MessageBox.Action.CLOSE],
                        onClose: function () {
                            this.onNavToReport();
                        }.bind(this)
                    });
                } else {
                    return true;
                }
            },

            async setNotifDataToView(oResp) {

                this.getViewModel().setProperty("/Header", oResp);
                this.getViewModel().setProperty("/PrevRefQmnum", oResp.RefQmnum);

                this.onRefreshAtta();

                this.getViewModel().setProperty("/Vehicle", oResp.Vehicle.results);
                this.getViewModel().setProperty("/Comment", oResp.Comment.results);

                this.getViewModel().setProperty("/Flow", oResp.Flow.results);
                this.getViewModel().setProperty("/FlowGenerated", oResp.Flow.results.length > 0);
                this._setFlowToView(oResp.Flow.results);

                let oLogged = this.getViewModel().getProperty("/LoggedUser");
                this.getViewModel().setProperty("/CurrentApr", oResp.CurrentApr.results);
                let isAprUrtmKltLogged = oResp.CurrentApr.results.some(item => item.Aprgr === "ÜRTMKAL");
                let isAprLogged = oResp.CurrentApr.results.some(item => item.Aprvr === oLogged.Uname);

                //oResp.CurrentApr.results içindeki Aprst 03 olan ilk kayıttaki Aprgr değerini al
                let aAprgr = oResp.CurrentApr.results.filter(item => item.Aprst === "03");
                let sCurrentAprgr = aAprgr.length > 0 ? aAprgr[0].Aprgr : "";


                let IsNew = oResp.Statu === "";
                let IsEditable = (!(oResp.Statu === "E0002" && oLogged.IsSupplier) &&
                    ((oResp.Statu === "" || oResp.Statu === "E0001" || oResp.Statu === "E0002") && (oResp.Ernam === oLogged.Uname || oLogged.AuthAdmin)) || (oResp.Statu === "E0002" && !oLogged.IsSupplier));
                let ReqKarsan = oResp.Statu === "E0002";
                let InAprProccess = oResp.Statu === "E0003";
                let IsCancelled = oResp.Statu === "E0004";
                let IsCompleted = oResp.Statu === "E0004" || oResp.Statu === "E0005" || oResp.Statu === "E0006";

                // IsEditable = false;
                this.getViewModel().setProperty("/Editable", IsEditable);
                this.getViewModel().setProperty("/ReqKarsan", ReqKarsan);
                this.getViewModel().setProperty("/InAprProccess", InAprProccess);
                this.getViewModel().setProperty("/IsCancelled", IsCancelled);
                this.getViewModel().setProperty("/IsCompleted", IsCompleted);
                this.getViewModel().setProperty("/IsSupplierLogged", oLogged.IsSupplier);
                this.getViewModel().setProperty("/isAprLogged", isAprLogged || oLogged.AuthAdmin);
                this.getViewModel().setProperty("/CurrentAprgr", sCurrentAprgr);
                this.getViewModel().setProperty("/isAprUrtmKltLogged", isAprUrtmKltLogged);

                this.getViewModel().setProperty("/TabAuth", {
                    General: true,
                    Vehicle: !oLogged.IsSupplier && (IsEditable || InAprProccess || IsCompleted),
                    Flow: !oLogged.IsSupplier && (IsEditable || InAprProccess || IsCompleted),
                    Attachment: true,
                    Comment: true,
                });

                this.getViewModel().setProperty("/ActionVis", {
                    CancelNotif: !oLogged.IsSupplier && (oResp.Ernam === oLogged.Uname || oLogged.AuthAdmin),
                    SaveNotif: !IsCompleted && (IsEditable || oLogged.AuthAdmin),
                    SendToKarsan: !IsCompleted && IsEditable && oLogged.IsSupplier,
                    SendForApproval: !IsCompleted && !InAprProccess && !oLogged.IsSupplier && (oResp.Ernam === oLogged.Uname || oLogged.AuthAdmin),
                    CancelAndCopy: !IsNew && !oLogged.IsSupplier && (oResp.Ernam === oLogged.Uname || oLogged.AuthAdmin),
                });

                this.getViewModel().setProperty("/VisDetail", true);
                BusyIndicator.hide();

            },

            onChangeRefQmnum(oEvent) {
                let that = this;
                let sNew = "";
                let sOld = this.getViewModel().getProperty("/PrevRefQmnum");
                if (oEvent.hasOwnProperty("mParameters")) {
                    sNew = oEvent?.getParameter("value");
                } else {
                    sNew = oEvent;
                }

                this.confirmAction(that.getText("ConfirmGetRefQmnum"), this.getView())
                    .then(async function (oResult) {
                        if (oResult.confirmed) {
                            try {
                                const sPath = oData.createKey("/ShRefQmnumSet", { Qmnum: sNew });
                                let oRefQmnum = await that.onRead(sPath, oData);
                                that.getViewModel().setProperty("/PrevRefQmnum", oRefQmnum.Qmnum);
                                that._loadNotif(sNew);
                            } catch (error) {
                                that.getViewModel().setProperty("/Header/RefQmnum", sOld);
                                return MessageBox.error(that.getText("ErrNotFoundRefQmnum"));
                            }
                        } else {
                            that.getViewModel().setProperty("/Header/RefQmnum", sOld);
                            MessageToast.show(that.getText("MsgCancelled"));
                        }
                    });
            },

            async onGenerateFlow() {
                let that = this;
                let oHeader = this.getViewModel().getProperty("/Header");

                if (!oHeader.Kaynak || !oHeader.PartStatu || !oHeader.HataTuru) {
                    return MessageBox.error(this.getText("MsgFlowNotGenerated"));
                }

                try {
                    BusyIndicator.show();
                    let oResp = await that.onCreate("/HeaderSet", that._buildReqHeaderCreate("GenFlow"), oData);
                    const hasError = oResp.Return.results.some(item =>
                        ["E", "A", "X"].includes(item.Type)
                    );
                    if (!hasError) {
                        that.getViewModel().setProperty("/Flow", oResp.Flow.results);
                        that.getViewModel().setProperty("/FlowGenerated", true);
                        that._setFlowToView(oResp.Flow.results);
                    }
                    that._showMessage(oResp.Return.results);
                } catch (error) {
                    that.handleServiceResponse();
                } finally {
                    BusyIndicator.hide();
                }

            },

            onDeleteFlow(oEvent) {
                let that = this;
                this.confirmAction(that.getText("ConfirmClearFlow"), this.getView())
                    .then(async function (oResult) {
                        if (oResult.confirmed) {
                            that.getViewModel().setProperty("/FlowView", []);
                            that.getViewModel().setProperty("/Flow", []);
                            that.getViewModel().setProperty("/FlowGenerated", false);
                        } else {
                            MessageToast.show(that.getText("MsgCancelled"));
                        }
                    });
            },

            async onAddApprover() {
                let oSelObject = {};
                let oTable = this.byId("IdflowTable");
                let oSelectItem = oTable.getSelectedItem();

                if (!oSelectItem) {
                    return MessageBox.error(this.getText("ErrSelectFlowGroup"));
                } else {
                    oSelObject = oSelectItem.getBindingContext("viewModel").getObject();
                }

                let aSelected = await this.onOpenApproverList(oSelObject.Aprgr);

                // ✅ Seçili onaylayanları flow'a ek
                // if (aSelected.length > 0) {
                if (aSelected.length > 0) {
                    let aFlow = this.getViewModel().getProperty("/Flow");
                    let aGroup = aFlow.filter(g => g.Aprgr === oSelObject.Aprgr);
                    let oGroup = aGroup[0];
                    let sNextPosnr = Math.max(...aFlow.filter(g => g.Aprgr === oSelObject.Aprgr).map(g => parseInt(g.Posnr, 10)), 0) + 1;
                    aSelected.forEach(selected => {

                        // ✅ Aynı onaylayan var mı kontrol et
                        let isDuplicate = aFlow.some(flowItem => flowItem.Aprgr === oGroup.Aprgr && flowItem.Aprvr === selected.Aprvr);
                        if (isDuplicate) {
                            return;
                        }

                        aFlow.push({
                            Qmnum: this.getViewModel().getProperty("/Header/Qmnum"),
                            Aprgr: oGroup.Aprgr,
                            Agrtx: oGroup.Agrtx,
                            Posnr: sNextPosnr,
                            Aprvr: selected.Aprvr,
                            AprvrFullname: selected.AprvrFullname,
                            Aprst: '01',
                            AprstTxt: this.getText("AprstTxt01"),
                        });
                        sNextPosnr++;
                    });
                    this.getViewModel().setProperty("/Flow", aFlow);
                    this._setFlowToView(aFlow);
                } else {
                    MessageToast.show(this.getText("MsgNoApproverSelected"));
                }
            },
            onOpenApproverList(vAprgr) {
                const that = this;

                return new Promise(function (resolve) {

                    // Search Input
                    const oSearchInput = new Input({
                        id: "IdAprvrSearch",
                        placeholder: that.getText("Search"),
                        liveChange: function (oEvent) {
                            let sValue = oEvent.getParameter("value");
                            let oList = oEvent.getSource().getParent().getAggregation("items")[1]
                            let aItems = oList.getItems();

                            aItems.forEach(oItem => {
                                let sAprvr = oItem.getBindingContext()?.getProperty("Aprvr") || "";
                                let bVisible = !sValue || sAprvr.toUpperCase().includes(sValue.toUpperCase());
                                oItem.setVisible(bVisible);
                            })
                        }
                    });

                    // List
                    const oList = new List({
                        id: "IdAprvrList",
                        mode: "MultiSelect",
                        items: {
                            path: "/ShAprvrSet",
                            filters: [new Filter("Aprgr", FilterOperator.EQ, vAprgr)],
                            template: new sap.m.StandardListItem({
                                title: "{AprvrFullname}",
                                description: "{Aprvr}",
                                selected: false
                            })
                        }
                    });

                    oList.addStyleClass("sapUiTinyMarginBeginEnd sapUiTinyMarginTopBottom");

                    const oDialog = new Dialog({
                        title: that.getText("SelectApprover"),
                        content: [
                            new VBox({
                                items: [
                                    oSearchInput,
                                    oList
                                ],
                                spacing: "0.5rem"
                            })
                        ],
                        beginButton: new Button({
                            text: that.getText("Complete"),
                            type: ButtonType.Emphasized,
                            press: function () {
                                let aSelectedItems = oList.getSelectedItems();
                                let aSelected = [];

                                aSelectedItems.forEach(oItem => {
                                    let oData = oItem.getBindingContext().getObject();
                                    aSelected.push({
                                        Posnr: "",
                                        Aprvr: oData.Aprvr,
                                        AprvrFullname: oData.AprvrFullname,
                                    });
                                });

                                resolve(aSelected);  // ✅ Seçili satırları döndür
                                oDialog.close();
                            }
                        }),
                        endButton: new Button({
                            text: that.getText("Cancel"),
                            type: ButtonType.Default,
                            press: function () {
                                resolve([]);  // ✅ Boş döndür
                                oDialog.close();
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

            _setFlowToView(aFlow) {
                let aFlowView = [];
                aFlow.forEach(item => {
                    let group = aFlowView.find(g => g.Aprgr === item.Aprgr);
                    if (!group) {
                        group = {
                            Aprgr: item.Aprgr,
                            Agrtx: item.Agrtx,
                            Aprst: item.Aprst,
                            AprstTxt: item.AprstTxt,
                            Descr: item.Descr,
                            Trapr: item.Trapr,
                            Trdat: item.Trdat,
                            Aprdt: item.Aprdt,
                            Item: []
                        };
                        aFlowView.push(group);
                    }
                    if (item.Aprvr !== '') {
                        const existingAprvr = group.Item.some(existingItem => existingItem.Aprvr === item.Aprvr);
                        if (!existingAprvr) {
                            group.Item.push({
                                Posnr: item.Posnr,
                                Aprvr: item.Aprvr,
                                AprvrFullname: item.AprvrFullname,
                            });
                        }
                    }
                });

                let isMgdInFlow = aFlowView.some(group => group.Aprgr === "MGD" && group.Item.length > 0);
                this.getViewModel().setProperty("/isMgdInFlow", isMgdInFlow);
                this.getViewModel().setProperty("/FlowView", aFlowView);

            },

            _setFlowFromView() {
                let vQmnum = this.getViewModel().getProperty("/Header/Qmnum");
                let aFlowView = this.getViewModel().getProperty("/FlowView");
                let aFlow = [];

                let oPosnrCounter = {};

                if (Array.isArray(aFlowView)) {
                    aFlowView.forEach(group => {
                        // Her grup için counter başlat
                        if (!oPosnrCounter[group.Aprgr]) {
                            oPosnrCounter[group.Aprgr] = 1;
                        }

                        group.Item.forEach(item => {
                            const existingFlow = aFlow.some(flowItem =>
                                flowItem.Aprgr === group.Aprgr && flowItem.Aprvr === item.Aprvr
                            );
                            if (!existingFlow) {
                                aFlow.push({
                                    Qmnum: vQmnum,
                                    Aprgr: group.Aprgr,
                                    Agrtx: group.Agrtx,
                                    Posnr: String(oPosnrCounter[group.Aprgr]++),
                                    Aprvr: item.Aprvr,
                                    AprvrFullname: item.AprvrFullname,
                                    Aprst: group.Aprst,
                                    AprstTxt: group.AprstTxt,
                                    Descr: group.Descr,
                                    Trapr: group.Trapr,
                                    Trdat: group.Trdat,
                                    Aprdt: group.Aprdt,
                                });
                            }
                        });
                    });
                }
                this.getViewModel().setProperty("/Flow", aFlow);
                return aFlow;
            },

            onRemoveAprvr(oEvent) {
                let aFlow = this.getViewModel().getProperty("/Flow");
                let vAprgr = oEvent.getSource().getParent().getParent().getParent().getParent().getBindingContext("viewModel").getObject().Aprgr;
                let vPosnr = oEvent.getSource().getParent().getBindingContext("viewModel").getObject().Posnr;

                // Silinecek olan kaydın indexini bul
                let iRemoveIndex = aFlow.findIndex(item => item.Aprgr === vAprgr && item.Posnr === vPosnr);

                if (iRemoveIndex === -1) {
                    return; // Kayıt bulunamadı
                }

                // ✅ Aynı Aprgr'dan başka kayıt var mı kontrol et
                let aOtherRecords = aFlow.filter(item => item.Aprgr === vAprgr && item.Posnr !== vPosnr);

                if (aOtherRecords.length > 0) {
                    // ✅ Başka kayıt varsa tamamen sil
                    aFlow = aFlow.filter(item => !(item.Aprgr === vAprgr && item.Posnr === vPosnr));
                } else {
                    // ✅ Başka kayıt yoksa sadece bazı alanları temizle
                    let oRemoveItem = aFlow[iRemoveIndex];
                    oRemoveItem.Aprvr = "";
                    oRemoveItem.AprvrFullname = "";
                    oRemoveItem.Aprst = "";
                    oRemoveItem.AprstTxt = "";
                    oRemoveItem.Descr = "";
                    oRemoveItem.Trapr = "";
                    oRemoveItem.Trdat = null;
                    oRemoveItem.Aprdt = null;
                }

                // Posnr'ları yeniden numaralandır (aynı Aprgr içinde)
                let posCounter = 1;
                aFlow.forEach(item => {
                    if (item.Aprgr === vAprgr && item.Aprvr !== "") {
                        item.Posnr = String(posCounter++);
                    }
                });

                this.getViewModel().setProperty("/Flow", aFlow);
                this._setFlowToView(aFlow);
            },

            // Araç Ekleme/Silme İşlemleri
            onPrevMultiAddVehicle(oEvent) {
                const oHeader = this.getViewModel().getProperty("/Header") || {};
                if (!oHeader.UrunGrubu) {
                    return MessageBox.error(this.getText("NeedUrunGrubu"));
                }
                this.byId("IdVIntervalBox").setVisible(!this.byId("IdVIntervalBox").getVisible());
            },

            onCloseMultiAddVehicle() {
                this.byId("IdVIntervalBox").setVisible(false);
            },

            onMultiAddVehicle() {
                var that = this;
                let oHeader = this.getViewModel().getProperty("/Header") || {};
                let sVehicleStartSasi = this.getViewModel().getProperty("/VehicleStartSasi");
                let sVehicleEndSasi = this.getViewModel().getProperty("/VehicleEndSasi");

                if (!sVehicleStartSasi || !sVehicleEndSasi) {
                    return MessageBox.error(this.getText("ErrVehicleInterval"));
                }

                BusyIndicator.show();
                let aFilter = [
                    new Filter("SasiNo", FilterOperator.BT, sVehicleStartSasi, sVehicleEndSasi),
                    new Filter("UrunGrubu", FilterOperator.EQ, oHeader.UrunGrubu)
                ];
                oData.read("/ShSasiSet", {
                    filters: aFilter,
                    success: oResponse => {

                        if (oResponse.results.length > 0) {
                            this.getViewModel().setProperty("/VehicleStartSasi", "");
                            this.getViewModel().setProperty("/VehicleEndSasi", "");
                            let aVehicle = this.getViewModel().getProperty("/Vehicle");
                            oResponse.results.forEach(e => {
                                aVehicle.push({ SasiNo: e.SasiNo });
                            });
                            this.getViewModel().setProperty("/Vehicle", aVehicle);
                            this._formatVehicleTable();
                            this.onCloseMultiAddVehicle();
                            BusyIndicator.hide();

                        } else {
                            BusyIndicator.hide();
                            return MessageBox.error(that.getText("ErrNotFoundInterval"));
                        }
                    },
                    error: e => {
                        let aMessages = [];
                        let aDefaultMsg = this.getView().getModel().getMessagesByPath("");
                        let aEntityMsg = this.getView().getModel().getMessagesByEntity("/ShSasiSet");
                        aMessages = [...aDefaultMsg, ...aEntityMsg];
                        BusyIndicator.hide();
                        this._showMessage(this._formatMessage(aMessages, "FrontSide"));
                    }
                });

            },

            onAddVehicle() {
                const oHeader = this.getViewModel().getProperty("/Header") || {};
                if (!oHeader.UrunGrubu) {
                    return MessageBox.error(this.getText("NeedUrunGrubu"));
                }

                let aVehicle = this.getViewModel().getProperty("/Vehicle");
                aVehicle.push({
                    SasiNo: ""
                });
                this.getViewModel().setProperty("/Vehicle", aVehicle);
                this._formatVehicleTable();
            },

            onRemoveVehicle(oEvent) {
                let aDel = [];
                let aSelItem = this.byId("IdTableVehicle").getSelectedItems();
                this.byId("IdTableVehicle").removeSelections();

                aSelItem.forEach(e => {
                    let oSasi = e.getBindingContext("viewModel").getObject();
                    aDel.push({ SasiNo: oSasi.SasiNo });
                });

                let aVehicle = this.getViewModel().getProperty("/Vehicle");
                let bSasiSet = new Set(aDel.map(item => item.SasiNo));
                let result = aVehicle.filter(item => !bSasiSet.has(item.SasiNo));
                this.getViewModel().setProperty("/Vehicle", result);
                this._formatVehicleTable();
            },

            _formatVehicleTable() {

                let aVehicle = this.getViewModel().getProperty("/Vehicle");
                aVehicle.sort((x, y) => x.SasiNo.localeCompare(y.SasiNo));

                let seen = new Set();
                let emptyAllowed = true;

                let cleaned = aVehicle.filter(item => {
                    const SasiNo = item.SasiNo.trim();
                    item.SasiNo = SasiNo;

                    if (!SasiNo) {
                        if (emptyAllowed) {
                            emptyAllowed = false;
                            return true;
                        }
                        return false;
                    }

                    if (seen.has(SasiNo)) {
                        return false;
                    }

                    seen.add(SasiNo);
                    return true;
                });

                this.getViewModel().setProperty("/Vehicle", cleaned);
            },

            //Attachments
            async uploadFiles(sQmnum) {
                const oAttaUploader = this.byId("IdAttaUploader");
                const aIncompleteAttachments = oAttaUploader.getIncompleteItems();
                const iAttachmentItemsCount = aIncompleteAttachments.length;
                const sServiceUrl = this.getUploadUrl(sQmnum);

                if (iAttachmentItemsCount) {
                    aIncompleteAttachments.forEach(oAttachment => {
                        oAttachment.setUploadUrl(sServiceUrl);
                    });
                    await oAttaUploader.upload();
                }
            },

            getUploadUrl(sQmnum) {
                const oModel = this.getModel();
                const oViewModel = this.getViewModel();
                const vQmnum = oViewModel.getProperty("/Header/Qmnum") || {};
                const sPath = oModel.createKey("/HeaderSet", {
                    Qmnum: sQmnum || vQmnum
                });
                const sServiceURL = oModel.sServiceUrl;
                return `${sServiceURL}${sPath}/Attachment`;
            },

            onBeforeAttUpload(oEvent) {
                const oModel = this.getModel();
                const oItem = oEvent.getParameter("item");
                oModel.refreshSecurityToken();
                oItem.removeAllHeaderFields();
                oItem.addHeaderField(new sap.ui.core.Item({
                    key: "x-csrf-token",
                    text: oModel.getSecurityToken()
                }));

                oItem.addHeaderField(new sap.ui.core.Item({
                    key: "slug",
                    text: encodeURIComponent(oItem.getFileName())
                }));
            },

            async onComplAttUpload(oEvent) {
                const oDocument = oEvent.getParameter("item");
                if (oDocument?.getUploadState() === "Complete") {
                    this.byId("IdAttaUploader").removeItem(oDocument);
                    await this.onRefreshAtta();
                }
            },

            async onRemoveAttItem(oEvent) {
                const oViewModel = this.getViewModel();
                const sPath = oEvent.getParameter("item")?.getBindingContext("viewModel")?.getPath();
                const aAtta = oViewModel.getProperty("/Attachment") || [];
                const oAtta = oViewModel.getProperty(sPath);

                if (oAtta) {
                    const oModel = this.getModel();
                    const oAttaKey = oModel.createKey("/AttachmentSet", {
                        Qmnum: oAtta.Qmnum,
                        RecGuid: oAtta.RecGuid,
                        AppType: oAtta.AppType,
                        ObjKey: oAtta.ObjKey
                    });
                    const iIndex = +sPath.split('/').pop();

                    BusyIndicator.show();
                    try {
                        await this.onDelete(oAttaKey, oModel);
                        aAtta.splice(iIndex, 1);
                        oViewModel.setProperty("/Attachment", aAtta);
                        BusyIndicator.hide();
                        MessageToast.show(this.getText("successDeleteAtta"));
                    } catch (oError) {
                        BusyIndicator.hide();
                    }
                }
            },

            onOpenAttItem: function (oEvent) {
                const oItem = oEvent.getSource().getParent();
                const oViewModel = this.getViewModel();
                const sPath = oItem.getBindingContext("viewModel").getPath();
                const oAttachment = oViewModel.getProperty(sPath);

                if (oAttachment) {
                    window.open(oAttachment.Url, "_blank");
                }
            },

            onRefreshAtta: async function () {
                let oQmnum = this.getViewModel().getProperty("/Header/Qmnum") || "";
                BusyIndicator.show();
                let aAtta = await this.onReadQuery("/AttachmentSet", [new Filter("Qmnum", FilterOperator.EQ, oQmnum)], oData);
                this.getViewModel().setProperty("/Attachment", aAtta.results || []);
                BusyIndicator.hide();
            },

            // Yorum Ekle/Sil 
            onPostComment(oEvent) {
                const oHeader = this.getViewModel().getProperty("/Header") || {};
                const sComment = oEvent.getParameter("value");
                if (!sComment) {
                    return MessageBox.error(this.getText("NoCommentProvided"));
                }
                const aComments = this.getViewModel().getProperty("/Comment");
                const iNewPosnr = aComments.length > 0 ? Math.max(...aComments.map(comment => comment.Posnr)) + 1 : 1;
                aComments.push({
                    Qmnum: oHeader?.Qmnum || "",
                    Posnr: String(iNewPosnr),
                    Descr: sComment,
                    Erdat: new Date(),
                    Erzet: this.getCurrentTimeEdmFormat(),
                    Ernam: oHeader?.Ernam || "",
                    ErnamFullname: oHeader?.ErnamFullname || ""
                });
                aComments.sort((a, b) => a.Posnr - b.Posnr);
                aComments.forEach((comment, index) => {
                    comment.Posnr = String(index + 1);
                });
                this.getViewModel().setProperty("/Comment", aComments);
            },

            onEditComment(oEvent) {
                let vIndex = oEvent.getSource().getParent().getBindingContext("viewModel").getPath().slice(9);
                let aComment = this.getViewModel().getProperty("/Comment");
                this.byId("IdCommentInput").setValue(aComment[vIndex].Descr);
                aComment.splice(vIndex, 1);
                aComment.forEach((item, index) => {
                    item.Posnr = String(index + 1);
                });
                this.getViewModel().setProperty("/Comment", aComment);
            },

            onRemoveComment(oEvent) {
                let vIndex = oEvent.getSource().getParent().getBindingContext("viewModel").getPath().slice(9);
                let aComment = this.getViewModel().getProperty("/Comment");
                aComment.splice(vIndex, 1);

                aComment.forEach((item, index) => {
                    item.Posnr = String(index + 1);
                });
                this.getViewModel().setProperty("/Comment", aComment);
            },

            onSaveNotif() {
                let that = this;
                this.confirmAction(that.getText("ConfirmSaveNotif"), this.getView())
                    .then(async function (oResult) {
                        if (oResult.confirmed) {
                            try {
                                BusyIndicator.show();
                                let oHeader = that.getViewModel().getProperty("/Header");
                                let isCreate = oHeader.Qmnum === "&1";
                                let oNew = await that.onCreate("/HeaderSet", that._buildReqHeaderCreate("SaveNotif"), oData);
                                const hasError = oNew.Return.results.some(item =>
                                    ["E", "A", "X"].includes(item.Type)
                                );
                                if (!hasError) {
                                    await that.uploadFiles(oNew.Qmnum)
                                    if (isCreate) {
                                        that.getRouter().navTo("Notif", { Qmnum: oNew.Qmnum });
                                    }
                                    await that._loadNotif(oNew.Qmnum)
                                }
                                that._showMessage(oNew.Return.results);
                            } catch (error) {
                                that.handleServiceResponse();
                            } finally {
                                BusyIndicator.hide();
                            }

                        } else {
                            MessageToast.show(that.getText("MsgCancelled"));
                        }
                    });
            },

            onSendToKarsan() {
                let that = this;
                let oViewModel = this.getViewModel();
                let oHeader = oViewModel.getProperty("/Header") || {};

                if (this._checkSuppNotif() === "OK") {
                    this.confirmAction(that.getText("ConfirmSendToKarsan"), this.getView())
                        .then(async function (oResult) {
                            if (oResult.confirmed) {

                                try {
                                    BusyIndicator.show();
                                    let isCreate = oHeader.Qmnum === "&1";
                                    let oNew = await that.onCreate("/HeaderSet", that._buildReqHeaderCreate("SendToKrsn"), oData);
                                    const hasError = oNew.Return.results.some(item =>
                                        ["E", "A", "X"].includes(item.Type)
                                    );
                                    if (!hasError) {
                                        await that.uploadFiles(oNew.Qmnum)
                                        if (isCreate) {
                                            that.getRouter().navTo("Notif", { Qmnum: oNew.Qmnum });
                                        }
                                        await that._loadNotif(oNew.Qmnum)
                                    }
                                    that._showMessage(oNew.Return.results);
                                } catch (error) {
                                    that.handleServiceResponse();
                                } finally {
                                    BusyIndicator.hide();
                                }
                            } else {
                                MessageToast.show(that.getText("MsgCancelled"));
                            }
                        });
                }
            },

            onCancelNotif() {
                let that = this;
                let oViewModel = this.getViewModel();
                let oHeader = oViewModel.getProperty("/Header") || {};

                this.confirmAction(that.getText("ConfirmCancelNotif"), this.getView(), 3)
                    .then(async function (oResult) {
                        if (oResult.confirmed) {

                            if (oHeader.Qmnum === "&1") {
                                return that.onNavToReport();
                            }

                            try {
                                BusyIndicator.show();
                                let oReq = that._buildReqHeaderCreate("CancelNotif");
                                oReq.CancelRsn = oResult.description || "";
                                let oNew = await that.onCreate("/HeaderSet", oReq, oData);
                                const hasError = oNew.Return.results.some(item =>
                                    ["E", "A", "X"].includes(item.Type)
                                );
                                if (!hasError) {
                                    await that._loadNotif(oNew.Qmnum)
                                }
                                that._showMessage(oNew.Return.results);
                            } catch (error) {
                                that.handleServiceResponse();
                            } finally {
                                BusyIndicator.hide();
                            }
                        } else {
                            MessageToast.show(that.getText("MsgCancelled"));
                        }
                    });
            },

            onCancelAndCopy() {
                let that = this;
                let oViewModel = this.getViewModel();
                let oHeader = oViewModel.getProperty("/Header") || {};

                oViewModel.setProperty("/CopyByCancel", false);
                let oCbox = new sap.m.CheckBox({
                    text: that.getText("CopyByCancel"),
                    selected: false,
                    select: function (oEvent) {
                        oViewModel.setProperty("/CopyByCancel", oEvent.getParameter("selected"));
                        that._sRequired = oEvent.getParameter("selected");
                    }
                });
                oCbox.addStyleClass("sapUiSmallMarginTopBottom");

                this.confirmAction(that.getText("ConfirmCancelAndCopyNotif"), this.getView(), 4, oCbox)
                    .then(async function (oResult) {
                        if (oResult.confirmed) {
                            try {
                                BusyIndicator.show();
                                let sUtil = oViewModel.getProperty("/CopyByCancel") ? "CancelCopy" : "Copy";
                                let oReq = that._buildReqHeaderCreate(sUtil);
                                oReq.CancelRsn = oResult.description || "";
                                let oNew = await that.onCreate("/HeaderSet", oReq, oData);
                                const hasError = oNew.Return.results.some(item =>
                                    ["E", "A", "X"].includes(item.Type)
                                );
                                if (!hasError) {
                                    that.getRouter().navTo("Notif", { Qmnum: oNew.Qmnum });
                                }
                                that._showMessage(oNew.Return.results);
                            } catch (error) {
                                that.handleServiceResponse();
                            } finally {
                                BusyIndicator.hide();
                            }
                        } else {
                            MessageToast.show(that.getText("MsgCancelled"));
                        }
                    });
            },

            onSendForApproval() {
                let that = this;
                if (this._checkNotif() === "OK") {
                    this.confirmAction(that.getText("ConfirmSendForApproval"), this.getView())
                        .then(async function (oResult) {
                            if (oResult.confirmed) {
                                try {
                                    BusyIndicator.show();
                                    let oHeader = that.getViewModel().getProperty("/Header");
                                    let isCreate = oHeader.Qmnum === "&1";
                                    let oNew = await that.onCreate("/HeaderSet", that._buildReqHeaderCreate("SendApr"), oData);
                                    const hasError = oNew.Return.results.some(item =>
                                        ["E", "A", "X"].includes(item.Type)
                                    );
                                    if (!hasError) {
                                        await that.uploadFiles(oNew.Qmnum)
                                        if (isCreate) {
                                            that.getRouter().navTo("Notif", { Qmnum: oNew.Qmnum });
                                        }
                                        await that._loadNotif(oNew.Qmnum)
                                    }
                                    that._showMessage(oNew.Return.results);
                                } catch (error) {
                                    that.handleServiceResponse();
                                } finally {
                                    BusyIndicator.hide();
                                }

                            } else {
                                MessageToast.show(that.getText("MsgCancelled"));
                            }
                        });
                }
            },

            handleServiceResponse: function (sSet) {
                let aMessages = [];
                let aDefaultMsg = this.getView().getModel().getMessagesByPath("");
                let aEntityMsg = this.getView().getModel().getMessagesByEntity(sSet || "/HeaderSet");
                aMessages = [...aDefaultMsg, ...aEntityMsg];
                this._showMessage(aMessages);
            },

            _checkSuppNotif() {
                this._clearMessages();
                let oDetail = this.getViewModel().getData();
                let aMessage = [];
                const oHeader = oDetail.Header;

                const isEmpty = (value) => {
                    if (value instanceof Date) {
                        return value === null;
                    }
                    return value === undefined || value === null || value?.trim() === "" || (Number(value) <= 0);
                };

                // Yardımcı fonksiyon: Hata ekle
                const addError = (key, section) => {
                    aMessage.push({
                        type: "Error",
                        title: this.getText(key),
                        subtitle: this.getText(section),
                        description: this.getText(key)
                    });
                };

                // Boş alan kontrolleri
                ["Matnr", "Lifnr", "Tekrar", "Kaynak"].forEach((field) => {
                    if (isEmpty(oHeader[field])) {
                        addError("ErrEnter" + field, "FundamentalTitle");
                    }
                });

                const hasRkmng = oHeader.Rkmng > 0;
                const hasBegda = !isEmpty(oHeader.Begda);
                const hasEndda = !isEmpty(oHeader.Endda);
                const hasDate = hasBegda && hasEndda; 
                
                if (!hasRkmng && !hasDate) {
                    addError("ErrMengeOrDate", "FundamentalTitle");
                }

                ["SapmaTuru", "SapmaDescr", "SpmNrmlDrm", "SpmDrm", "HataTuru"].forEach((field) => {
                    if (isEmpty(oHeader[field])) {
                        addError("ErrEnter" + field, "SapmaDetailTitle");
                    }
                });

                ["RootIssue", "SapmaFix", "SapmaFixDat", "SapmaPrevent", "SapmaPreDat"].forEach((field) => {
                    if (isEmpty(oHeader[field])) {
                        addError("ErrEnter" + field, "SapmaAnalysisTitle");
                    } else if (typeof oHeader[field] === "string" && oHeader[field].trim().length < 10) {
                        addError("ErrMin10Char" + field, "SapmaAnalysisTitle");
                    }

                });

                // Hata varsa göster
                return aMessage.some(msg => msg.type === "Error")
                    ? this._showMessage(aMessage)
                    : "OK";

            },

            _checkNotif() {
                this._clearMessages();
                let oDetail = this.getViewModel().getData();
                let aMessage = [];
                const oHeader = oDetail.Header;

                const isEmpty = (value) => {
                    if (value instanceof Date) {
                        return value === null;
                    }
                    return value === undefined || value === null || value?.trim() === "" || (Number(value) <= 0);
                };

                // Yardımcı fonksiyon: Hata ekle
                const addError = (key, section) => {
                    aMessage.push({
                        type: "Error",
                        title: this.getText(key),
                        subtitle: this.getText(section),
                        description: this.getText(key)
                    });
                };

                // Boş alan kontrolleri
                ["Matnr", "Lifnr", "UrunGrubu", "Tekrar", "Kaynak"].forEach((field) => {
                    if (isEmpty(oHeader[field])) {
                        addError("ErrEnter" + field, "FundamentalTitle");
                    }
                });

                const hasRkmng = oHeader.Rkmng > 0;
                const hasBegda = !isEmpty(oHeader.Begda);
                const hasEndda = !isEmpty(oHeader.Endda);
                const hasDate = hasBegda && hasEndda; 
                if (!hasRkmng && !hasDate) {
                    addError("ErrMengeOrDate", "FundamentalTitle");
                }


                ["SapmaTuru", "SapmaDescr", "SpmNrmlDrm", "SpmDrm", "HataTuru", "AracBolumu"].forEach((field) => {
                    if (isEmpty(oHeader[field])) {
                        addError("ErrEnter" + field, "SapmaDetailTitle");
                    }
                });

                ["RootIssue", "SapmaFix", "SapmaFixDat", "SapmaPrevent", "SapmaPreDat"].forEach((field) => {
                    if (isEmpty(oHeader[field])) {
                        addError("ErrEnter" + field, "SapmaAnalysisTitle");
                    } else if (typeof oHeader[field] === "string" && oHeader[field].trim().length < 10) {
                        addError("ErrMin10Char" + field, "SapmaAnalysisTitle");
                    }

                });


                if (oDetail.Flow.length < 1) {
                    addError("ErrGenFlow", "FlowTitle");
                }

                // Her Aprgr için en az bir Aprvr olmalı yoksa hata
                const aprgrSet = new Set(oDetail.Flow.map(item => item.Aprgr));
                aprgrSet.forEach(aprgr => {
                    const hasAprvr = oDetail.Flow.some(item => item.Aprgr === aprgr && !isEmpty(item.Aprvr));
                    if (!hasAprvr) {
                        addError("ErrAprvrForAprgr", "FlowTitle");
                    }
                });

                // Hata varsa göster
                return aMessage.some(msg => msg.type === "Error")
                    ? this._showMessage(aMessage)
                    : "OK";
            },

            onApprove(oEvent) {
                let that = this;
                this.confirmAction(that.getText("ConfirmApprove"), this.getView())
                    .then(async function (oResult) {
                        if (oResult.confirmed) {
                            try {
                                BusyIndicator.show();
                                let oNew = await that.onCreate("/HeaderSet", that._buildReqHeaderCreate("Approve"), oData);
                                const hasError = oNew.Return.results.some(item =>
                                    ["E", "A", "X"].includes(item.Type)
                                );
                                if (!hasError) {
                                    await that.uploadFiles(oNew.Qmnum)
                                    await that._loadNotif(oNew.Qmnum)
                                }
                                that._showMessage(oNew.Return.results);
                            } catch (error) {
                                that.handleServiceResponse();
                            } finally {
                                BusyIndicator.hide();
                            }

                        } else {
                            MessageToast.show(that.getText("MsgCancelled"));
                        }
                    });

            },

            onReject(oEvent) {
                let that = this;

                let oDecide = oEvent.getSource().getParent().getParent().getParent().getBindingContext("viewModel").getObject();
                if (!oDecide.Descr || oDecide.Descr.trim() === "") {
                    return MessageBox.error(that.getText("ErrEnterRejectReason"));
                }

                this.confirmAction(that.getText("ConfirmReject"), this.getView())
                    .then(async function (oResult) {
                        if (oResult.confirmed) {
                            try {
                                BusyIndicator.show();
                                let oNew = await that.onCreate("/HeaderSet", that._buildReqHeaderCreate("Reject"), oData);
                                const hasError = oNew.Return.results.some(item =>
                                    ["E", "A", "X"].includes(item.Type)
                                );
                                if (!hasError) {
                                    await that.uploadFiles(oNew.Qmnum)
                                    await that._loadNotif(oNew.Qmnum)
                                }
                                that._showMessage(oNew.Return.results);
                            } catch (error) {
                                that.handleServiceResponse();
                            } finally {
                                BusyIndicator.hide();
                            }

                        } else {
                            MessageToast.show(that.getText("MsgCancelled"));
                        }
                    });

            },

            onDetermineMgd(oEvent) {
                let that = this;

                this.confirmAction(that.getText("ConfirmDetermineMgd"), this.getView())
                    .then(async function (oResult) {
                        if (oResult.confirmed) {

                            let vAprgr = "MGD";
                            let aSelected = await that.onOpenApproverList(vAprgr);

                            // ✅ Seçili onaylayanları flow'a ekle
                            if (aSelected.length > 0) {
                                let aFlow = that.getViewModel().getProperty("/Flow");
                                let aGroup = aFlow.filter(g => g.Aprgr === vAprgr);
                                let oGroup = aGroup[0] || { Aprgr: vAprgr, Agrtx: that.getText("AprgrMGD") };
                                let sNextPosnr = Math.max(...aFlow.filter(g => g.Aprgr === vAprgr).map(g => parseInt(g.Posnr, 10)), 0) + 1;
                                aSelected.forEach(selected => {

                                    // ✅ Aynı onaylayan var mı kontrol et
                                    let isDuplicate = aFlow.some(flowItem => flowItem.Aprgr === oGroup.Aprgr && flowItem.Aprvr === selected.Aprvr);
                                    if (isDuplicate) {
                                        return;
                                    }

                                    aFlow.push({
                                        Qmnum: that.getViewModel().getProperty("/Header/Qmnum"),
                                        Aprgr: oGroup.Aprgr,
                                        Agrtx: oGroup.Agrtx,
                                        Posnr: sNextPosnr,
                                        Aprvr: selected.Aprvr,
                                        AprvrFullname: selected.AprvrFullname,
                                        Aprst: '01',
                                        AprstTxt: that.getText("AprstTxt01"),
                                    });
                                    sNextPosnr++;
                                });
                                that.getViewModel().setProperty("/Flow", aFlow);
                                that._setFlowToView(aFlow);
                            } else {
                                MessageToast.show(that.getText("MsgNoApproverSelected"));
                            }

                        } else {
                            MessageToast.show(that.getText("MsgCancelled"));
                        }
                    });

            },

            onDeleteMgd(oEvent) {
                let that = this;
                this.confirmAction(that.getText("ConfirmDeleteMgd"), this.getView())
                    .then(function (oResult) {
                        if (oResult.confirmed) {
                            let vAprgr = "MGD";
                            let aFlow = that.getViewModel().getProperty("/Flow");
                            let filteredFlow = aFlow.filter(item => item.Aprgr !== vAprgr);
                            that.getViewModel().setProperty("/Flow", filteredFlow);
                            that._setFlowToView(filteredFlow);
                            MessageToast.show(that.getText("MsgDeleteMgdSuccess"));
                        } else {
                            MessageToast.show(that.getText("MsgCancelled"));
                        }
                    });
            },

            _buildReqHeaderCreate(vUtil) {

                let oDetail = this.getViewModel().getData();

                oDetail.Comment?.forEach(e => {
                    delete e.__metadata;
                    delete e.ErdatFormatted;
                    e.Qmnum = oDetail.Header.Qmnum;
                    e.Erdat = this._formatDate(e.Erdat);
                });

                return {
                    Util: vUtil,
                    Qmnum: oDetail.Header.Qmnum,
                    RefQmnum: oDetail.Header.RefQmnum,
                    Matnr: oDetail.Header.Matnr,
                    Rkmng: oDetail.Header.Rkmng,
                    Mgein: oDetail.Header.Mgein,
                    Lifnr: oDetail.Header.Lifnr,
                    UrunGrubu: oDetail.Header.UrunGrubu,
                    Begda: oDetail.Header.Begda,
                    Endda: oDetail.Header.Endda,
                    Tekrar: oDetail.Header.Tekrar,
                    PartStatu: oDetail.Header.PartStatu,
                    Kaynak: oDetail.Header.Kaynak,
                    SapmaTuru: oDetail.Header.SapmaTuru,
                    SapmaDescr: oDetail.Header.SapmaDescr,
                    SpmNrmlDrm: oDetail.Header.SpmNrmlDrm,
                    SpmDrm: oDetail.Header.SpmDrm,
                    HataTuru: oDetail.Header.HataTuru,
                    AracBolumu: oDetail.Header.AracBolumu,
                    RootIssue: oDetail.Header.RootIssue,
                    SapmaFix: oDetail.Header.SapmaFix,
                    SapmaPrevent: oDetail.Header.SapmaPrevent,
                    Prueflos: oDetail.Header.Prueflos,
                    SapmaFixDat: oDetail.Header.SapmaFixDat,
                    SapmaPreDat: oDetail.Header.SapmaPreDat,
                    CancelRsn: oDetail.Header.CancelRsn,
                    // Arrays
                    Flow: this._setFlowFromView(),
                    Vehicle: oDetail.Vehicle,
                    Comment: oDetail.Comment,
                    Return: []
                };

            },

            _setInitModel() {
                this.getViewModel().setProperty("/VisDetail", false);
                this.getViewModel().setProperty("/Header", {});
                this.getViewModel().setProperty("/Flow", []);
                this.getViewModel().setProperty("/FlowView", []);
                this.getViewModel().setProperty("/Vehicle", []);
                this.getViewModel().setProperty("/Comment", []);
                this.getViewModel().setProperty("/FlowGenerated", false);
                this.getViewModel().setProperty("/Editable", false);
            },

            //Formatters  
            _formatDate: function (pDate) {
                if (pDate instanceof Date) {
                    var r = pDate.getTimezoneOffset();
                    pDate.setMinutes(pDate.getMinutes() - r);
                }
                return pDate;
            },

            _removeSpaces(sText) {
                if (typeof sText === "string") {
                    return sText.replace(/^\s+/, "");
                }
                return sText;
            },

            _formatQuantity(sQuan) {

                var fValue = parseFloat(sQuan);
                if (isNaN(fValue)) {
                    return;
                }
                return fValue.toLocaleString('en-US', {
                    useGrouping: false,
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3
                });
            },

            onNavToReport() {
                this.getViewModel().setProperty("/DetailVis", false);
                this.getRouter().navTo("Report");
            },

            onInfoPress(sField, oEvent) {
                let sInfoText = this.getText("Info" + sField);

                let oText = new Text({ text: sInfoText });
                oText.addStyleClass("sapUiSmallMargin");

                this._oInfoPopover = new Popover({
                    content: oText,
                    showHeader: false
                });
                this.getView().addDependent(this._oInfoPopover);
                this._oInfoPopover.openBy(oEvent.getSource());
            },

            //onChange Input
            onChangeCombobox: function (oEvent) {

                var oValidatedComboBox = oEvent.getSource(),
                    sSelectedKey = oValidatedComboBox.getSelectedKey(),
                    sValue = oValidatedComboBox.getValue();

                if (!sSelectedKey && sValue) {
                    oValidatedComboBox.setValueState(ValueState.Error);
                    oValidatedComboBox.setValueStateText(this.getText("Invalid"));
                } else {
                    oValidatedComboBox.setValueState(ValueState.None);
                }
            },

            onChangeCharInput(oEvent) {
                var sMain = "",
                    vPath = "",
                    sVal = this._removeSpaces(oEvent.getParameter("value"));
                if (oEvent.getSource().getBinding("value").getContext()) {
                    sMain = oEvent.getSource().getBinding("value").getContext().sPath + '/';
                }
                var sPart = oEvent.getSource().getBinding("value").sPath
                if (!sMain) {
                    vPath = sMain + sPart;
                }
                this.getViewModel().setProperty(vPath, sVal);
            },

            onChangeQuanInput(oEvent) {
                var sMain = "",
                    vPath = "",
                    sVal = this._formatQuantity(oEvent.getParameter("value"));
                if (oEvent.getSource().getBinding("value").getContext()) {
                    sMain = oEvent.getSource().getBinding("value").getContext().sPath + '/';
                }
                var sPart = oEvent.getSource().getBinding("value").sPath
                if (!sMain) {
                    vPath = sMain + sPart;
                }
                this.getViewModel().setProperty(vPath, sVal);
            },

            onChangeInputSasi(oEvent) {
                this._formatVehicleTable();
            },

            onChangeInputLifnr(oEvent) {
                this.onChangeCharInput(oEvent);
                let vLifnr = this.getViewModel().getProperty("/Header/Lifnr");
                if (!vLifnr) {
                    this.getViewModel().setProperty("/Header/LfName1", "");
                } else {
                    let vMatnr = this.getViewModel().getProperty("/Header/Matnr");
                    if (!vMatnr) {
                        this.getViewModel().setProperty("/Header/Lifnr", "");
                        this.getViewModel().setProperty("/Header/LfName1", "");
                        return MessageBox.error(this.getText("EnterFirstMatnr"));
                    }
                }
            },

            onChangeInputMatnr(oEvent) {
                this.onChangeCharInput(oEvent);
                let vMatnr = this.getViewModel().getProperty("/Header/Matnr");
                if (!vMatnr) {
                    this.getViewModel().setProperty("/Header/Maktx", "");
                    this.getViewModel().setProperty("/Header/Mgein", "");
                    this.getViewModel().setProperty("/Header/Lifnr", "");
                    this.getViewModel().setProperty("/Header/LfName1", "");
                }
            },

            onChangeInputRkmng(oEvent) {
                this.onChangeQuanInput(oEvent);
            },


            //Suggestions
            onSuggestRefQmnum(oEvent) {
                const sValue = oEvent.getParameter("suggestValue");
                const oInput = oEvent.getSource();
                const oBinding = oInput.getBinding("suggestionItems");

                if (sValue.length >= 3) { // avoid unnecessary backend calls
                    const oFilter = new Filter("Qmnum", FilterOperator.Contains, sValue);
                    oBinding.filter([oFilter]);
                } else {
                    oBinding.filter([]);
                }
            },

            // Value Helps   
            onVhRefQmnum: function (oEvent) {
                let that = this;
                const oInput = oEvent.getSource();
                const oView = this.getView();
                const oModel = oView.getModel();

                this._SHRefQmnum = new ValueHelpDialog({
                    title: this.getText("ShRefQmnumTitle"),
                    supportMultiselect: false,
                    resizable: true,
                    key: "Qmnum",
                    ok: (okEvent) => {
                        let aTokens = okEvent.getParameter("tokens");
                        let sQmnum = aTokens[0].getKey();
                        oInput.setValue(sQmnum);
                        this._SHRefQmnum.close();
                        that.onChangeRefQmnum(sQmnum);
                    },
                    cancel: () => {
                        this._SHRefQmnum.close();
                    }
                });

                const oFilterBar = new FilterBar({
                    advancedMode: true,
                    liveMode: false,
                    search: this.onRefQmnumFilterSearch.bind(this),
                    filterGroupItems: [
                        new FilterGroupItem({
                            groupName: "__$INTERNAL$",
                            name: "Qmnum",
                            label: this.getText("Qmnum"),
                            control: new Input({
                                submit: () => this.onRefQmnumFilterSearch()
                            })
                        })
                    ]
                });

                this._SHRefQmnum.setFilterBar(oFilterBar);

                const oTable = this._SHRefQmnum.getTable();
                oTable.setModel(oModel);
                oTable.bindRows("/ShRefQmnumSet", null, null, []);

                ["Qmnum", "Qmtxt", "Mawerk", "Matnr", "Revlv"].forEach((field) => {
                    oTable.addColumn(new sap.ui.table.Column({
                        label: new Label({ text: this.getText(field) }),
                        template: new Text({ text: `{${field}}` }),
                    }));
                });

                this._SHRefQmnum.getTable().clearSelection()
                this._SHRefQmnum.update();
                this._SHRefQmnum.open();
            },

            onRefQmnumFilterSearch: function () {
                const oFilterBar = this._SHRefQmnum.getFilterBar();
                const oTable = this._SHRefQmnum.getTable();
                const aFilters = oFilterBar.getFilterGroupItems().reduce((acc, oItem) => {
                    const sField = oItem.getName();
                    const sValue = oFilterBar.determineControlByFilterItem(oItem).getValue();
                    if (sValue) {
                        acc.push(new Filter(sField, FilterOperator.Contains, sValue));
                        acc.push(new Filter(sField, FilterOperator.Contains, sValue.toUpperCase()));
                    }
                    return acc;
                }, []);
                oTable.getBinding("rows")?.filter(aFilters);
            },

            onVhSasi: function (oEvent) {
                const oInput = oEvent.getSource();
                const oView = this.getView();
                const oModel = oView.getModel();

                this._SHSasi = new ValueHelpDialog({
                    title: this.getText("ShSasiNoTitle"),
                    supportMultiselect: false,
                    resizable: true,
                    key: "SasiNo",
                    ok: (okEvent) => {
                        let aTokens = okEvent.getParameter("tokens");
                        oInput.setValue(aTokens[0].getKey());
                        oInput.setValueState("None");
                        this._SHSasi.close();
                    },
                    cancel: () => {
                        this._SHSasi.close();
                    }
                });

                const oFilterBar = new FilterBar({
                    advancedMode: true,
                    liveMode: false,
                    search: this.onSasiNoFilterSearch.bind(this),
                    filterGroupItems: [
                        new FilterGroupItem({
                            groupName: "__$INTERNAL$",
                            name: "SasiNo",
                            label: this.getText("SasiNo"),
                            control: new Input({
                                submit: () => this.onSasiNoFilterSearch()
                            })
                        })
                    ]
                });

                this._SHSasi.setFilterBar(oFilterBar);

                const oTable = this._SHSasi.getTable();
                oTable.setModel(oModel);

                const oHeader = this.getViewModel().getProperty("/Header");
                const aInitFilters = [];
                if (oHeader?.UrunGrubu) {
                    aInitFilters.push(new Filter("UrunGrubu", FilterOperator.EQ, oHeader?.UrunGrubu || ""));
                }
                if (oHeader?.MtrEmission) {
                    aInitFilters.push(new Filter("MtrEmission", FilterOperator.EQ, oHeader?.AracBolumu || ""));
                }
                oTable.bindRows("/ShSasiSet", null, null, aInitFilters);

                ["SasiNo", "GovdeNo"].forEach((field) => {
                    oTable.addColumn(new sap.ui.table.Column({
                        label: new Label({ text: this.getText(field) }),
                        template: new Text({ text: `{${field}}` }),
                    }));
                });

                this._SHSasi.getTable().clearSelection()
                this._SHSasi.update();
                this._SHSasi.open();
            },

            onSasiNoFilterSearch: function () {
                const oFilterBar = this._SHSasi.getFilterBar();
                const oTable = this._SHSasi.getTable();
                const aFilters = oFilterBar.getFilterGroupItems().reduce((acc, oItem) => {
                    const sField = oItem.getName();
                    const sValue = oFilterBar.determineControlByFilterItem(oItem).getValue();
                    if (sValue) {
                        acc.push(new Filter(sField, FilterOperator.Contains, sValue));
                        acc.push(new Filter(sField, FilterOperator.Contains, sValue.toUpperCase()));
                    }
                    return acc;
                }, []);
                oTable.getBinding("rows")?.filter(aFilters);
            },

            onVhLifnr: function (oEvent) {
                const oInput = oEvent.getSource();
                const oView = this.getView();
                const oModel = oView.getModel();

                // let vMatnr = this.getViewModel().getProperty("/Header/Matnr");
                // if (!vMatnr) {
                //     this.getViewModel().setProperty("/Header/Lifnr", "");
                //     this.getViewModel().setProperty("/Header/LfName1", "");
                //     return MessageBox.error(this.getText("EnterFirstMatnr"));
                // }

                this._SHLifnr = new ValueHelpDialog({
                    title: this.getText("ShLifnrTitle"),
                    supportMultiselect: false,
                    resizable: true,
                    key: "Lifnr",
                    ok: (okEvent) => {
                        let aTokens = okEvent.getParameter("tokens");
                        oInput.setValue(aTokens[0].getKey());

                        let oSelected = okEvent.getParameter("tokens")[0].getAggregation("customData")[0].getProperty("value");
                        this.getViewModel().setProperty("/Header/LfName1", oSelected?.Mcod1);

                        oInput.setValueState("None");
                        this._SHLifnr.close();
                    },
                    cancel: () => {
                        this._SHLifnr.close();
                    }
                });

                const oFilterBar = new FilterBar({
                    advancedMode: true,
                    liveMode: false,
                    search: this.onLifnrFilterSearch.bind(this),
                    filterGroupItems: [
                        new FilterGroupItem({
                            groupName: "__$INTERNAL$",
                            name: "Lifnr",
                            label: this.getText("Lifnr"),
                            control: new Input({
                                submit: () => this.onLifnrFilterSearch()
                            })
                        })
                    ]
                });

                this._SHLifnr.setFilterBar(oFilterBar);

                const oTable = this._SHLifnr.getTable();
                oTable.setModel(oModel);
                oTable.bindRows("/ShLifnrSet", null, null,
                    // [new Filter("Matnr", FilterOperator.EQ, vMatnr)]
                );

                ["Lifnr", "Mcod1"].forEach((field) => {
                    oTable.addColumn(new sap.ui.table.Column({
                        label: new Label({ text: this.getText(field) }),
                        template: new Text({ text: `{${field}}` }),
                    }));
                });

                this._SHLifnr.getTable().clearSelection()
                this._SHLifnr.update();
                this._SHLifnr.open();
            },

            onLifnrFilterSearch: function () {
                const oFilterBar = this._SHLifnr.getFilterBar();
                const oTable = this._SHLifnr.getTable();
                const aFilters = oFilterBar.getFilterGroupItems().reduce((acc, oItem) => {
                    const sField = oItem.getName();
                    const sValue = oFilterBar.determineControlByFilterItem(oItem).getValue();
                    if (sValue) {
                        acc.push(new Filter(sField, FilterOperator.Contains, sValue));
                        acc.push(new Filter(sField, FilterOperator.Contains, sValue.toUpperCase()));
                    }
                    return acc;
                }, []);
                oTable.getBinding("rows")?.filter(aFilters);
            },

            onVhMatnr: function (oEvent) {
                const oInput = oEvent.getSource();
                const oView = this.getView();
                const oModel = oView.getModel();
                const oHeader = this.getViewModel().getProperty("/Header");
                let aFilter = [];

                let vMatnr = this.getViewModel().getProperty("/Header/Lifnr");
                if (!vMatnr) {
                    this.getViewModel().setProperty("/Header/Matnr", "");
                    this.getViewModel().setProperty("/Header/Maktx", "");
                    return MessageBox.error(this.getText("EnterFirstLifnr"));
                }

                this._SHMatnr = new ValueHelpDialog({
                    title: this.getText("ShMatnrTitle"),
                    supportMultiselect: false,
                    resizable: true,
                    key: "Matnr",
                    ok: (okEvent) => {
                        let aTokens = okEvent.getParameter("tokens");
                        oInput.setValue(aTokens[0].getKey());

                        let oSelected = okEvent.getParameter("tokens")[0].getAggregation("customData")[0].getProperty("value");
                        this.getViewModel().setProperty("/Header/Maktx", oSelected?.Maktx);
                        this.getViewModel().setProperty("/Header/PartStatu", oSelected?.PartStatu);

                        oInput.setValueState("None");
                        this._SHMatnr.close();
                    },
                    cancel: () => {
                        this._SHMatnr.close();
                    }
                });

                const oFilterBar = new FilterBar({
                    advancedMode: true,
                    liveMode: false,
                    search: this.onMatnrFilterSearch.bind(this),
                    filterGroupItems: [
                        new FilterGroupItem({
                            groupName: "__$INTERNAL$",
                            name: "Matnr",
                            label: this.getText("Matnr"),
                            control: new Input({
                                submit: () => this.onMatnrFilterSearch()
                            })
                        })
                    ]
                });

                this._SHMatnr.setFilterBar(oFilterBar);

                const oTable = this._SHMatnr.getTable();
                oTable.setModel(oModel);
                if (oHeader.Lifnr) {
                    aFilter = [
                        new Filter("Lifnr", FilterOperator.EQ, oHeader.Lifnr)
                    ];
                }

                oTable.bindRows("/ShMatnrSet", null, null, aFilter);

                ["Matnr", "Maktx"].forEach((field) => {
                    oTable.addColumn(new sap.ui.table.Column({
                        label: new Label({ text: this.getText(field) }),
                        template: new Text({ text: `{${field}}` }),
                    }));
                });

                this._SHMatnr.getTable().clearSelection()
                this._SHMatnr.update();
                this._SHMatnr.open();
            },

            onMatnrFilterSearch: function () {
                const oFilterBar = this._SHMatnr.getFilterBar();
                const oTable = this._SHMatnr.getTable();
                const aFilters = oFilterBar.getFilterGroupItems().reduce((acc, oItem) => {
                    const sField = oItem.getName();
                    const sValue = oFilterBar.determineControlByFilterItem(oItem).getValue();
                    if (sValue) {
                        acc.push(new Filter(sField, FilterOperator.Contains, sValue));
                        acc.push(new Filter(sField, FilterOperator.Contains, sValue.toUpperCase()));
                    }
                    return acc;
                }, []);
                oTable.getBinding("rows")?.filter(aFilters);
            },

            // BTP Workzone User Info
            _getUserInformation: async function () {
                return new Promise((resolve, reject) => {
                    if (window.top === window) {
                        resolve(); // Standalone mode ise devam et
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

        });
    });
