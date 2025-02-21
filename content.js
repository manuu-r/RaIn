(function () {
  function log(msg, ...args) {
    console.log("[Gmail Internal Reply]", msg, ...args);
  }

  // Helper: simulate a more complete click
  function simulateClick(el) {
    if (!el) return;
    const mouseDown = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    const mouseUp = new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    el.dispatchEvent(mouseDown);
    el.dispatchEvent(mouseUp);
  }

  // Finds Gmail "Reply to all" menu items by checking their text.
  function findReplyAllButtons() {
    const menuItems = document.querySelectorAll("div[role='menuitem']");
    return Array.from(menuItems).filter((el) => {
      const text = el.textContent.trim().toLowerCase();
      return text.includes("reply to all") || text.includes("reply all");
    });
  }

  // Adds our custom "Reply All (domain)" button next to the native "Reply to all" item.
  function addInternalReplyButton() {
    const replyAllButtons = findReplyAllButtons();
    if (replyAllButtons.length === 0) return;
    replyAllButtons.forEach((replyAllButton) => {
      const parent = replyAllButton.parentElement;
      if (!parent || parent.querySelector(".internal-reply-all-btn")) return;

      // Get the company domain from storage and then add the button with that label.
      chrome.storage.sync.get("companyDomain", function (result) {
        let domain = result.companyDomain
          ? result.companyDomain.trim()
          : "yourdomain.com";
        const btn = document.createElement("div");
        btn.innerText = "Reply All (" + domain + ")";
        btn.className = "internal-reply-all-btn";
        btn.style.cursor = "pointer";
        btn.style.padding = "4px 8px";
        btn.style.marginLeft = "4px";
        btn.style.background = "#e0e0e0";
        btn.style.borderRadius = "4px";
        btn.style.fontSize = "small";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          handleInternalReplyAll(replyAllButton);
        });
        parent.appendChild(btn);
        log("Added internal reply button next to", replyAllButton);
      });
    });
  }

  // Handles the internal reply process:
  // 1. Simulates clicking the native "Reply to all" button.
  // 2. After waiting, retrieves the company domain from storage and removes external recipients.
  function handleInternalReplyAll(replyAllButton) {
    log("handleInternalReplyAll triggered for", replyAllButton);
    replyAllButton.click();
    simulateClick(replyAllButton);
    setTimeout(() => {
      chrome.storage.sync.get("companyDomain", function (result) {
        const domain = result.companyDomain
          ? result.companyDomain.trim()
          : "yourdomain.com";
        let modified = false;
        const recipientSelectors = [
          "textarea[name='to']",
          "input[name='to']",
          "textarea[name='cc']",
          "input[name='cc']",
        ];
        recipientSelectors.forEach((selector) => {
          const fields = document.querySelectorAll(selector);
          fields.forEach((field) => {
            const originalValue = field.value;
            let emails = originalValue
              .split(",")
              .map((email) => email.trim())
              .filter((email) => email);
            const filtered = emails.filter((email) =>
              email.toLowerCase().endsWith("@" + domain.toLowerCase()),
            );
            if (filtered.join(", ") !== originalValue) {
              field.value = filtered.join(", ");
              modified = true;
              log(
                `Field [${selector}] modified: before: "${originalValue}", after: "${field.value}"`,
              );
            }
          });
        });
        // If standard fields weren’t modified, try token removal.
        if (!modified) {
          log(
            "Standard fields not modified. Attempting token removal for tokenized UI.",
          );
          const tokens = document.querySelectorAll(
            "div[role='option'][data-hovercard-id]",
          );
          tokens.forEach((token) => {
            const email = token.getAttribute("data-hovercard-id");
            if (
              email &&
              !email.toLowerCase().endsWith("@" + domain.toLowerCase())
            ) {
              const removeBtn =
                token.querySelector("div[aria-label*='remove']") ||
                token.querySelector("div[aria-label*='delete']");
              if (removeBtn) {
                removeBtn.click();
                log("Removed external token via removal button:", email);
              } else {
                token.remove();
                log("Removed external token directly:", email);
              }
            }
          });
        }
      });
    }, 1200); // Adjust delay as needed
  }

  // Use a MutationObserver to continuously add our custom button when new UI elements appear.
  const observer = new MutationObserver(() => {
    addInternalReplyButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
