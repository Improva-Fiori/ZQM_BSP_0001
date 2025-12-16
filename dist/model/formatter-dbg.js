sap.ui.define([
  "sap/ui/core/format/DateFormat",
],
  function (DateFormat) {
    "use strict";
    return {

      setFieldEditable(vEdit, IsSupplier, ReqKarsan) {
        if (ReqKarsan === true) {
          return false;
        }
        if (IsSupplier === true) {
          return false;
        }
        return vEdit;
      },

      removeSpaces: function (sText) {
        if (typeof sText === "string") {
          return sText.replace(/^\s+/, "");
        }
        return sText;
      },

      formatQuantity: e => {
        var t = 0;
        e === "" || e === undefined ? (t = 0) : (t = e);
        let r = parseFloat(t.toString()).toFixed(3);
        return r.toString();
      },

      _setStatuState: e => {

        var vType;
        switch (e) {
          case 'DR':
            vType = 'Information';
            break;

          case 'OP':
            vType = 'Information';
            break;

          case 'PR':
            vType = 'Warning';
            break;

          case 'CN':
            vType = 'Error';
            break;

          case 'OK':
            vType = 'Success';
            break;
        }
        return vType;
      },

      _setHighlightFlowItem: e => {
        var vType;
        switch (e) {
          case '01': // Eklendi
            vType = 'Information';//Indication17';
            break;

          case '02': // Sırada
            vType = 'Information';
            break;

          case '03': // Bekleniyor
            vType = 'Warning';
            break;

          case '04': // pas
            vType = 'None';
            break;

          case '05': // red
            vType = 'Error';
            break;

          case '06': // Onaylandı
            vType = 'Success';
            break;

          case '07': // iptal 
            vType = 'None';
            break;

          case '09': // Onaycının Belirlenmesi Gerekli
            vType = 'Error';
            break;

          default:
            vType = 'None'
            break;
        }
        return vType;
      },

      formatInteger: e => {
        var t = 0;
        e === "" || e === undefined ? (t = 0) : (t = e);
        let r = parseFloat(t.toString()).toFixed(0);
        return r.toString();
      },

      formatMeasureQuantity: e => {
        var t = 0;
        e === "" || e === undefined ? (t = 0) : (t = e);
        let r = parseFloat(t.toString()).toFixed(3);
        return r.toString();
      },

      formatQuantityAsInt: e => {
        var t = 0;
        e === "" || e === undefined ? (t = 0) : (t = e);
        let r = parseFloat(t.toString()).toFixed(0);
        return r.toString();
      },

      formatAmount: e => {
        var t = 0;
        e === "" || e === undefined ? (t = 0) : (t = e);
        let r = parseFloat(t.toString()).toFixed(2);
        return r.toString();
      },

      formatItemNo: e => {
        return e.replace(/^0+/, "")
      },

      convertTime: e => {
        return new Date(e.ms).toISOString().slice(11, -5);
      },

      formatChargEdit: e => {
        return e === "" ? false : true;
      },

      formatStatuState: e => {
        switch (e) {
          case '01':
            return 'None'
          case '02':
            return 'Warning'
          case '03':
            return 'Warning'
          case '04':
            return 'Error'
          case '05':
            return 'Success'
        }
      },

      getImage: function (sPath) {
        if (!sPath) return;
        return `${jQuery.sap.getModulePath("com.karsan.qm.sapmaportali.image")}/${sPath}`;
      },

      _setCommentDate: function (oDate) {
        var oFormat = DateFormat.getDateTimeInstance({ style: "medium" });
        var sDate = oFormat.format(oDate);
      },

      _isMgdChangable(Aprgr, Aprst, oDetail, oGlobal) {
        let e = false;
        if (oDetail?.CurrentApr?.Aprvr === oGlobal?.LoggedUser?.Uname) {
          if (Aprgr === 'MGD') {
            if (Aprst === '01' || Aprst === '02' || Aprst === '09') {
              e = true;
            }
          } else {
            e = false;
          }
        } else {
          e = false;
        }
        return e;
      },

      formatPrueflos(sVal) {
        return sVal === "0" ? "" : sVal;
      },

      formatDateToTimestamp: (sDate, sTime) => {
        if (sDate && sTime) {
          const date = new Date(sDate);
          const time = new Date(sTime.ms);
          return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes(), time.getSeconds()).toLocaleString();
        }
        return "";
      },

    };
  });
