Page({
  onFetchProfile() {
    wx.request({
      url: "https://httpbin.org/get?action=fetchProfile&userId=12345",
      method: "GET",
      success(res) {
        console.log("Profile response:", res.data);
        wx.showToast({ title: "Profile Loaded", icon: "success" });
      },
    });
  },

  onUpdateAvatar() {
    wx.request({
      url: "https://httpbin.org/post",
      method: "POST",
      data: {
        userId: 12345,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
      },
      success(res) {
        console.log("Avatar updated:", res.data);
        wx.showToast({ title: "Avatar Updated", icon: "success" });
      },
    });
  },
});
