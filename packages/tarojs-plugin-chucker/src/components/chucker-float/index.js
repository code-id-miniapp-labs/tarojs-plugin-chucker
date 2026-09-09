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
      value: "/pages/chucker/index",
    },
  },
  methods: {
    navigate: function () {
      var url = (this.data && this.data.url) || (this.properties && this.properties.url) || "/pages/chucker/index";
      var api = getApi();
      if (api && typeof api.navigateTo === "function") {
        api.navigateTo({ url: url });
      }
    },
  },
});
