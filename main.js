// main.js
// Handles Google Calendar and Gemini integration
// --- Google Calendar API Setup ---
const CLIENT_ID = "1061855570713-evtnvbajus4st7fbhr90go06oa2ceong.apps.googleusercontent.com";
const API_KEY = "AIzaSyD957EbYeShcEtgsEPUVRXu6v5eL5DGLWc";
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
let tokenClient;
let gapiInited = false;
let gisInited = false;




document.addEventListener("DOMContentLoaded", function() {
  // Ensure Google API scripts are loaded
  function loadScript(src, callback) {
    const script = document.createElement('script');
    script.src = src;
    script.onload = callback;
    document.head.appendChild(script);
  }
  function initGapiAndGis() {
    if (window.gapi && window.google && window.google.accounts && window.google.accounts.oauth2) {
      gapi.load('client', async () => {
        await gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"]
        });
        gapiInited = true;
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (resp) => {
            if (resp.error !== undefined) throw (resp);
            // After sign-in, import events if requested
            if (window._doImportAfterAuth) {
              window._doImportAfterAuth();
              window._doImportAfterAuth = null;
            }
          }
        });
        gisInited = true;
      });
    } else {
      setTimeout(initGapiAndGis, 100);
    }
  }
  // Load Google API scripts if not present
  if (!window.gapi) loadScript("https://apis.google.com/js/api.js", initGapiAndGis);
  else initGapiAndGis();
  if (!window.google || !window.google.accounts) loadScript("https://accounts.google.com/gsi/client", initGapiAndGis);
  // Get FullCalendar instance
  let calendar;
  const calendarEl = document.getElementById("calendar");
  if (calendarEl && typeof FullCalendar !== "undefined") {
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      events: [],
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      views: {
        dayGridMonth: { buttonText: 'Month' },
        timeGridWeek: { buttonText: 'Week' },
        timeGridDay: { buttonText: 'Day' }
      }
    });
    calendar.render();
  }
  

  // Modal for confirmation
  function showConfirmModal(message, onConfirm) {
    let modalDiv = document.createElement("div");
    modalDiv.innerHTML = `
      <div class="modal fade" id="importConfirmModal" tabindex="-1" aria-labelledby="importConfirmLabel" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="importConfirmLabel">Confirm Import</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">${message}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button id="modalOkBtn" type="button" class="btn btn-primary">OK</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalDiv);
    let modal = new bootstrap.Modal(modalDiv.querySelector(".modal"));
    modal.show();
    modalDiv.querySelector("#modalOkBtn").onclick = () => {
      modal.hide();
      document.body.removeChild(modalDiv);
      onConfirm();
    };
    modalDiv.querySelector(".btn-secondary").onclick = () => {
      modal.hide();
      document.body.removeChild(modalDiv);
    };
  }

  // Modal for confirmation
  function showConfirmModal(message, onConfirm) {
    let modalDiv = document.createElement("div");
    modalDiv.innerHTML = `
      <div class="modal fade" id="importConfirmModal" tabindex="-1" aria-labelledby="importConfirmLabel" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="importConfirmLabel">Confirm Import</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">${message}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button id="modalOkBtn" type="button" class="btn btn-primary">OK</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalDiv);
    let modal = new bootstrap.Modal(modalDiv.querySelector(".modal"));
    modal.show();
    modalDiv.querySelector("#modalOkBtn").onclick = () => {
      modal.hide();
      document.body.removeChild(modalDiv);
      onConfirm();
    };
    modalDiv.querySelector(".btn-secondary").onclick = () => {
      modal.hide();
      document.body.removeChild(modalDiv);
    };
  }

  // Import Google Calendar events
  async function importGoogleCalendarEvents() {
    try {
      if (!window.gapi || !gapi.client || !gapi.client.calendar) {
        alert("Google API client not loaded. Try again in a few seconds.");
        return;
      }
      // Get all calendars
      const calListResp = await gapi.client.calendar.calendarList.list();
      const calendars = calListResp.result.items;
      if (!calendars || calendars.length === 0) {
        alert("No calendars found for this account.");
        return;
      }
      console.log("Google Calendars:");
      calendars.forEach(cal => {
        console.log(`- ${cal.summary} (ID: ${cal.id}) [Access: ${cal.accessRole}]`);
      });
      // Remove existing events before import
      if (calendar && calendar.getEvents) {
        calendar.getEvents().forEach(ev => ev.remove());
      }
      let totalEvents = 0;
      for (const cal of calendars) {
        try {
          const response = await gapi.client.calendar.events.list({
            calendarId: cal.id,
            timeMin: new Date().toISOString(),
            showDeleted: false,
            singleEvents: true,
            maxResults: 50,
            orderBy: "startTime"
          });
          const events = response.result.items;
          console.log(`Fetched ${events ? events.length : 0} events from calendar: ${cal.summary}`);
          if (events && events.length > 0 && calendar && calendar.addEvent) {
            events.forEach(ev => {
              const start = ev.start.dateTime || ev.start.date;
              const end = ev.end.dateTime || ev.end.date;
              calendar.addEvent({
                id: ev.id,
                title: `[${cal.summary}] ${ev.summary || "Google Event"}`,
                start,
                end,
                extendedProps: { source: cal.summary || cal.id }
              });
            });
            totalEvents += events.length;
          }
        } catch (calErr) {
          console.error(`Error fetching events for calendar ${cal.summary}:`, calErr);
        }
      }
      alert(`Imported ${totalEvents} events from all Google Calendars.`);
    } catch (err) {
      console.error("Calendar API error:", err);
      alert("Failed to fetch Google Calendar events: " + err.message);
    }
  }

  // Button click triggers token request and import
  const importBtn = document.getElementById("btnImport");
  if (importBtn) {
    importBtn.onclick = async () => {
      // Check if already authorized
      if (!gapiInited || !gisInited || !tokenClient) {
        alert("Google API not initialized yet. Please wait and try again.");
        return;
      }
      const token = gapi.client.getToken && gapi.client.getToken();
      const doImport = () => {
        if (calendar && calendar.getEvents && calendar.getEvents().length > 0) {
          showConfirmModal(
            "There are already events in your calendar. Importing will remove them and add Google Calendar events. Are you sure?",
            importGoogleCalendarEvents
          );
        } else {
          importGoogleCalendarEvents();
        }
      };
      if (token && token.access_token) {
        // Already authorized, just import
        doImport();
      } else {
        // Not authorized, request access then import
        window._doImportAfterAuth = doImport;
        tokenClient.requestAccessToken({prompt: 'consent'});
      }
    };
  }

  // --- Other button handlers and Gemini integration can go here ---
  // Place any additional button handlers or Gemini code here, inside this handler.
// End of DOMContentLoaded

  async function initializeGapiClient() {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
    });
    gapiInited = true;
    maybeEnableButtons();
  }

  function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error !== undefined) throw (resp);
        log("✅ Signed in!");
        if (authorizeButton) authorizeButton.style.display = "none";
        if (signoutButton) signoutButton.style.display = "inline-block";
        if (testEventButton) testEventButton.style.display = "inline-block";
      },
    });
    gisInited = true;
    maybeEnableButtons();
  }

  if (geminiButton) {
    geminiButton.onclick = async () => {
      const prompt = "Suggest a study schedule for my hackathon tasks.";
      try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });
        const data = await response.json();
        log("🤖 Gemini says: " + (data.candidates?.[0]?.content?.parts?.[0]?.text || "No response"));
      } catch (err) {
        log("❌ Gemini error: " + err.message);
      }
    };
  }

  // Redefine maybeEnableButtons globally for use in init
  window.maybeEnableButtons = maybeEnableButtons;
});

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
  });
  gapiInited = true;
  maybeEnableButtons();
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error !== undefined) throw (resp);
      log("✅ Signed in!");
      authorizeButton.style.display = "none";
      signoutButton.style.display = "inline-block";
      testEventButton.style.display = "inline-block";
    },
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    authorizeButton.style.display = "inline-block";
  }
}

authorizeButton.onclick = () => {
  tokenClient.requestAccessToken({ prompt: "consent" });
};

signoutButton.onclick = () => {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken("");
    log("🚪 Signed out");
    authorizeButton.style.display = "inline-block";
    signoutButton.style.display = "none";
    testEventButton.style.display = "none";
  }
};

testEventButton.onclick = async () => {
  if (!gapiInited || !gapi.client.calendar) {
    log("❌ Google Calendar API not initialized yet. Please wait and try again.");
    return;
  }
  const event = {
    summary: "Hackathon Test Event",
    start: { dateTime: new Date().toISOString(), timeZone: "UTC" },
    end: { dateTime: new Date(Date.now() + 60*60*1000).toISOString(), timeZone: "UTC" },
  };
  try {
    const request = await gapi.client.calendar.events.insert({
      calendarId: "primary",
      resource: event,
    });
    log("📅 Event created: " + request.result.htmlLink);
  } catch (err) {
    log("❌ Error creating event: " + err.message);
  }
};

geminiButton.onclick = async () => {
  const prompt = "Suggest a study schedule for my hackathon tasks.";
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    const data = await response.json();
    log("🤖 Gemini says: " + (data.candidates?.[0]?.content?.parts?.[0]?.text || "No response"));
  } catch (err) {
    log("❌ Gemini error: " + err.message);
  }

};