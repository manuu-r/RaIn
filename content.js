(function () {
  function log(msg, ...args) {
    // Removed log function implementation
  }

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

  function findReplyAllButtons() {
    const menuItems = document.querySelectorAll("div[role='menuitem']");
    return Array.from(menuItems).filter((el) => {
      const text = el.textContent.trim().toLowerCase();
      return text.includes("reply to all") || text.includes("reply all");
    });
  }

  function addInternalReplyButton() {
    const replyAllButtons = findReplyAllButtons();
    if (replyAllButtons.length === 0) return;
    replyAllButtons.forEach((replyAllButton) => {
      const parent = replyAllButton.parentElement;
      if (!parent || parent.querySelector(".internal-reply-all-btn")) return;

      chrome.storage.sync.get("companyDomain", function (result) {
        let domain = result.companyDomain
          ? result.companyDomain.trim()
          : "yourdomain.com";
        const btn = document.createElement("div");
        btn.className = "internal-reply-all-btn";
        btn.style.cursor = "pointer";
        btn.style.padding = "4px 8px";
        btn.style.marginLeft = "4px";
        btn.style.background = "#e0e0e0";
        btn.style.borderRadius = "4px";
        btn.style.fontSize = "small";
        btn.style.display = "flex";
        btn.style.alignItems = "center";

        const fallbackIcon = document.createElement("span");
        fallbackIcon.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4L12 12L20 4"></path><path d="M20 8L12 16L4 8"></path></svg>';
        fallbackIcon.style.marginRight = "4px";
        btn.appendChild(fallbackIcon);

        const textSpan = document.createElement("span");
        textSpan.innerText = "Reply All (" + domain + ")";
        btn.appendChild(textSpan);

        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          handleInternalReplyAll(replyAllButton);
        });
        parent.appendChild(btn);
      });
    });
  }

  function handleInternalReplyAll(replyAllButton) {
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
            }
          });
        });
        if (!modified) {
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
              } else {
                token.remove();
              }
            }
          });
        }
      });
    }, 1200);
  }

  function collectEmails() {
    const emailSet = new Set();
    const selectors = [
      "span[email]",
      "[data-hovercard-id]",
      "[data-email]",
      "div[role='listitem'] span",
    ];

    // This regular expression will match valid email addresses
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        const email =
          el.getAttribute("email") ||
          el.getAttribute("data-hovercard-id") ||
          el.getAttribute("data-email") ||
          el.textContent;
        if (email && email.includes("@")) {
          // Extract email from text if it's part of a string
          const match = email.match(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
          );
          if (match && emailRegex.test(match[0])) {
            emailSet.add(match[0].toLowerCase());
          }
        }
      });
    });

    // Removed text content scanning to reduce garbage duplicates
    const emails = Array.from(emailSet);
    return emails;
  }

  function fetchSentEmails() {
    const sentLink = document.querySelector("a[href*='/#sent']");
    if (sentLink && !window.location.hash.includes("#sent")) {
      sentLink.click();
      setTimeout(() => {
        const emails = collectEmails();
        chrome.storage.local.set({ sentEmails: emails }, () => {
          const inboxLink = document.querySelector("a[href*='/#inbox']");
          if (inboxLink) inboxLink.click();
        });
      }, 1000);
    } else {
      const emails = collectEmails();
      chrome.storage.local.set({ sentEmails: emails });
    }
  }

  function addCustomAutocomplete() {
    const recipientFields = document.querySelectorAll(
      "input[aria-label='To recipients'], input[aria-label='CC recipients'], input[aria-label='BCC recipients'], input[role='combobox']",
    );
    recipientFields.forEach((field) => {
      if (field.dataset.autocompleteAdded) return;
      field.dataset.autocompleteAdded = true;

      field.addEventListener("input", handleInput);
      field.addEventListener("keydown", handleInput); // Fallback for tokenized inputs
    });

    setInterval(() => {
      const newFields = document.querySelectorAll(
        "input[aria-label='To recipients'], input[aria-label='CC recipients'], input[aria-label='BCC recipients'], input[role='combobox']",
      );
      newFields.forEach((field) => {
        if (!field.dataset.autocompleteAdded) {
          field.dataset.autocompleteAdded = true;
          field.addEventListener("input", handleInput);
          field.addEventListener("keydown", handleInput);
        }
      });
    }, 5000);
  }

  function handleInput(e) {
    const field = e.target;
    const query = (field.value || "").trim().toLowerCase();
    if (!query) {
      removeSuggestionBox(field);
      return;
    }

    chrome.storage.local.get(["sentEmails", "allEmails"], (result) => {
      const sentEmails = result.sentEmails || [];
      const allEmails = result.allEmails || [];
      const currentEmails = collectEmails();
      const combinedEmails = [
        ...new Set([...sentEmails, ...allEmails, ...currentEmails]),
      ];

      const matches = combinedEmails
        .filter((email) => email.toLowerCase().includes(query))
        .slice(0, 5);
      if (matches.length === 0) {
        removeSuggestionBox(field);
        return;
      }
      showSuggestionBox(field, matches);
    });
  }

  function showSuggestionBox(field, matches) {
    removeSuggestionBox(field);

    // Create Gmail-style autocomplete container
    const suggestionBox = document.createElement("div");
    suggestionBox.className = "custom-autocomplete-box afC mS5Pff";
    suggestionBox.style.display = "block";
    suggestionBox.style.position = "absolute";
    suggestionBox.style.zIndex = "10000";
    suggestionBox.style.width = `${field.offsetWidth}px`;
    // Moved the box further down to avoid hiding text
    suggestionBox.style.top = `${field.offsetTop + field.offsetHeight + 50}px`;
    suggestionBox.style.left = `${field.offsetLeft}px`;

    // Create inner container
    const innerContainer = document.createElement("div");
    innerContainer.className = "afA mS5Pff";

    // Create another wrapper div
    const wrapper = document.createElement("div");
    wrapper.className = "afB";

    // Create list container
    const listContainer = document.createElement("div");
    listContainer.tabIndex = "-1";
    listContainer.className = "agO";

    // Create ul element for options
    const ulElement = document.createElement("ul");
    ulElement.className = "ahx";
    ulElement.role = "listbox";
    ulElement.setAttribute("aria-multiselectable", "true");

    // Add email matches as Gmail-style options
    matches.forEach((email) => {
      // Create container for option
      const optionDiv = document.createElement("div");
      optionDiv.className = "agJ aFw";
      optionDiv.role = "option";
      optionDiv.setAttribute("aria-disabled", "false");
      optionDiv.setAttribute("aria-selected", "false");

      // Create option content wrapper
      const optionContentDiv = document.createElement("div");
      optionContentDiv.className = "agK";

      // Create email info container
      const emailInfoDiv = document.createElement("div");
      emailInfoDiv.className = "agH";
      emailInfoDiv.setAttribute("data-hovercard-id", email);

      // Create avatar container
      const avatarContainerDiv = document.createElement("div");
      avatarContainerDiv.className = "agy";

      // Create avatar inner container
      const avatarInnerDiv = document.createElement("div");
      avatarInnerDiv.className = "agz";

      // Create avatar image container
      const avatarImgContainer = document.createElement("div");
      avatarImgContainer.className = "aLO";
      avatarImgContainer.style.width = "32px";
      avatarImgContainer.style.height = "32px";

      // Add default avatar style
      const avatarDiv = document.createElement("div");
      avatarDiv.className = "afD";
      avatarDiv.style.width = "32px";
      avatarDiv.style.height = "32px";

      // Create wrapper for the avatar
      const avatarWrapper = document.createElement("div");
      avatarWrapper.className = "afF";

      // Create avatar inner wrapper
      const avatarInnerWrapper = document.createElement("div");
      avatarInnerWrapper.className = "afI";

      // Create avatar image
      const avatarImg = document.createElement("img");
      avatarImg.className = "afH";
      avatarImg.style.width = "32px";
      avatarImg.style.height = "32px";
      avatarImg.draggable = false;
      avatarImg.alt = "";
      avatarImg.src = "https://lh3.googleusercontent.com/a/default-user=s32-p";

      // Assemble avatar hierarchy
      avatarInnerWrapper.appendChild(avatarImg);
      avatarWrapper.appendChild(avatarInnerWrapper);
      avatarDiv.appendChild(avatarWrapper);
      avatarImgContainer.appendChild(avatarDiv);
      avatarInnerDiv.appendChild(avatarImgContainer);
      avatarContainerDiv.appendChild(avatarInnerDiv);
      emailInfoDiv.appendChild(avatarContainerDiv);
      optionContentDiv.appendChild(emailInfoDiv);

      // Create text content container
      const textContentDiv = document.createElement("div");
      textContentDiv.className = "agB";

      // Create inner text container
      const innerTextDiv = document.createElement("div");
      innerTextDiv.className = "agF";

      // Create email display name container
      const emailNameDiv = document.createElement("div");
      emailNameDiv.className = "agE agG";

      // Create email display element
      const emailDisplay = document.createElement("div");
      emailDisplay.className = "aL8";
      emailDisplay.setAttribute("data-hovercard-id", email);
      emailDisplay.setAttribute("translate", "no");

      // Try to highlight the matching part of the email
      const index = email.toLowerCase().indexOf(field.value.toLowerCase());
      if (index >= 0) {
        const beforeMatch = email.substring(0, index);
        const match = email.substring(index, index + field.value.length);
        const afterMatch = email.substring(index + field.value.length);
        emailDisplay.innerHTML =
          beforeMatch + "<b>" + match + "</b>" + afterMatch;
      } else {
        emailDisplay.textContent = email;
      }

      emailNameDiv.appendChild(emailDisplay);
      innerTextDiv.appendChild(emailNameDiv);
      textContentDiv.appendChild(innerTextDiv);
      optionContentDiv.appendChild(textContentDiv);
      optionDiv.appendChild(optionContentDiv);

      // Add event listener to the option
      optionDiv.addEventListener("mousedown", (e) => {
        e.preventDefault();
        addEmailToField(field, email);
        removeSuggestionBox(field);
      });

      ulElement.appendChild(optionDiv);
    });

    // Assemble the full suggestion box hierarchy
    listContainer.appendChild(ulElement);
    wrapper.appendChild(listContainer);
    innerContainer.appendChild(wrapper);
    suggestionBox.appendChild(innerContainer);

    // Add to the DOM
    field.parentElement.appendChild(suggestionBox);
  }

  function addEmailToField(field, email) {
    // Clear the field before adding the email
    field.value = email;
  }

  function removeSuggestionBox(field) {
    const existingBox = field.parentElement.querySelector(
      ".custom-autocomplete-box",
    );
    if (existingBox) existingBox.remove();
  }

  function startEmailCollection() {
    const emails = collectEmails();
    chrome.storage.local.set({ allEmails: emails });
    fetchSentEmails();
    // Reduced frequency of email collection to avoid duplicates
    setInterval(() => {
      const newEmails = collectEmails();
      chrome.storage.local.get("allEmails", (result) => {
        const existingEmails = result.allEmails || [];
        // Filter out duplicates
        const combinedEmails = [...new Set([...existingEmails, ...newEmails])];
        chrome.storage.local.set({ allEmails: combinedEmails });
      });
      fetchSentEmails();
    }, 60000); // Increased to 1 minute from 30 seconds
  }

  const observer = new MutationObserver(() => {
    addInternalReplyButton();
    addCustomAutocomplete();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  startEmailCollection();
})();
