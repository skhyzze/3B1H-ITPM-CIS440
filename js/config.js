/* External endpoints for the Applied AI Lab site.
   Page scripts read these values. The URL strings match the previous copies.
   Account owners are also listed in the root README, under Accounts and handoff.
*/
window.LAB_CONFIG = {
  /* One switch for Industry Partners in the header, footer, home cards, and chatbot.
     false removes those links from the built site. industry.html stays reachable by its URL.
     Run npm run build after changing this. */
  showIndustryPartners: false,

  /* Cloudflare Worker that answers the site chatbot.
     Personal account: the Workers subdomain tan-gurpinar.workers.dev.
     This is not a lab-owned hostname. */
  chatEndpoint: "https://lab-chat.tan-gurpinar.workers.dev",

  /* Google Apps Script web app for The Circuit email subscribe form.
     Owner: the Google account that deployed this script. That account is not named in the repo. */
  newsletterSubscribeUrl: "https://script.google.com/macros/s/AKfycbyx00UsgASEw0tnGsR0At-JDQrG4a5fGHihSKIANXiyLZu7nufCU8CuhiEYdcVjLPrGSg/exec",

  /* Google Apps Script web app that stores Circuit likes.
     Owner: the Google account that deployed this script. That account is not named in the repo. */
  newsletterLikesUrl: "https://script.google.com/macros/s/AKfycbzAKsbaQZBCjk2Nvy41X4u76dRuA36ayQN5ZEl5NDW-0K_3rMHmaBNNqFPy4SYAdeq4sA/exec"
};
