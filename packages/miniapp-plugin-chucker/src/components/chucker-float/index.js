/* miniapp-chucker: Float Button Custom Component */
function getApi() {
  if (typeof wx !== "undefined" && wx && typeof wx.navigateTo === "function") return wx;
  if (typeof my !== "undefined" && my && typeof my.navigateTo === "function") return my;
  if (typeof tt !== "undefined" && tt && typeof tt.navigateTo === "function") return tt;
  try {
    if (typeof tx !== "undefined" && tx && typeof tx.navigateTo === "function") return tx;
  } catch (e) {}
  return null;
}

Component({
  properties: {
    url: {
      type: String,
      value: "",
    },
  },
  methods: {
    navigate: function () {
      var customUrl = (this.data && this.data.url) || (this.properties && this.properties.url);
      var url = customUrl || "/miniprogram_npm/miniapp-plugin-chucker/pages/chucker/index";
      var api = getApi();
      if (api && typeof api.navigateTo === "function") {
        api.navigateTo({
          url: url,
          fail: function () {
            api.navigateTo({ url: "/pages/chucker/index" });
          },
        });
      }
    },
  },
});
