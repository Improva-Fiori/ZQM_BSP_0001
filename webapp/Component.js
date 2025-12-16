sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "com/karsan/qm/sapmaportali/model/models" 
],
    function (UIComponent, Device, models) {
        "use strict";

        return UIComponent.extend("com.karsan.qm.sapmaportali.Component", {
            metadata: {
                manifest: "json",
                config: { fullWidth: true },
            },
            init: function () {
                UIComponent.prototype.init.apply(this, arguments);
                this.getRouter().initialize();
                this.setModel(models.createDeviceModel(), "device"); 
            }
        });
    }
);