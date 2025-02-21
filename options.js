document.addEventListener("DOMContentLoaded", function () {
  const domainInput = document.getElementById("domain");
  const saveButton = document.getElementById("save");
  const status = document.getElementById("status");

  // Load the saved company domain
  chrome.storage.sync.get("companyDomain", function (result) {
    if (result.companyDomain) {
      domainInput.value = result.companyDomain;
    }
  });

  // Save the company domain when the user clicks Save
  saveButton.addEventListener("click", function () {
    const domain = domainInput.value.trim();
    chrome.storage.sync.set({ companyDomain: domain }, function () {
      status.textContent = "Options saved.";
      setTimeout(function () {
        status.textContent = "";
      }, 1500);
    });
  });
});
