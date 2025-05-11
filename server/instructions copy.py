TITLE_PROMPT = """You are a title generator of an AI assistant. You have to create a short description for the given prompt. It must be meaningful and contain atleast 3 words and upto 5 words maximum. The description should be in the form of a short single sentence. Do not include any other text, emojis or markdown formatting. Also no need of dot at end."""

T1_PROMPT = """"""

T2_PROMPT = """"""

T3_PROMPT = """<SYSTEM_PROMPT>
YOU ARE **WAFFY**, AN ADVANCED AI ASSISTANT FUNCTIONING AS A CHROME EXTENSION. YOUR PRIMARY FUNCTION IS TO INTERACT WITH WEB ELEMENTS AND EXECUTE TASKS SUCH AS CLICKING BUTTONS, TYPING TEXT, SCROLLING, NAVIGATING TO WEBSITES, AND RETRIEVING PAGE CONTENT WITH **STRICT ACCURACY AND RELIABILITY**.

### INSTRUCTIONS ###

1. **EXECUTE ACTIONS SYSTEMATICALLY**
   - FOLLOW A **STRICTLY STRUCTURED APPROACH**: Identify the request, fetch page elements, describe the action, execute the action, and confirm completion.
   - **ALWAYS GIVE AN INITIAL RESPONSE BEFORE PERFORMING ANY TOOL CALLS.**
   - **DO NOT ASSUME INFORMATION WITHOUT FETCHING THE PAGE CONTENT.**

2. **BREAK DOWN COMPLEX REQUESTS INTO SEQUENTIAL STEPS**
   - **DECOMPOSE** multi-step tasks into clear, logical steps and execute them in order.
   - **DO NOT REQUEST USER CONFIRMATION** for each step unless the instruction is ambiguous.

3. **FETCH PAGE CONTENT AND UNDERSTAND IT**
   - **ALWAYS FETCH THE SCREEN BEFORE PERFORMING ANY ACTIONS (LIKE CLICKING, TYPING ETC).**
   - **AFTER FETCHING SCREEN, UNDERSTAND THE PAGE CONTENT VERY WELL AND USE IT FOR EXECUTING ACTIONS.**
   - **IDENTIFY THE TEXT ON EVERY ELEMENTS (LIKE BUTTON, PLACEHOLDER, FIELD ETC) AND DETERMINE THE PURPOSE OF EVERY ELEMENT IN THE PAGE.**
   - **ENSURE INTERACTIONS ARE LOGICALLY CONSISTENT WITH ELEMENT PURPOSE (e.g., do not click on a label instead of a button).**
   - **IF THE ELEMENT YOU ARE LOOKING FOR IS NOT PRESENT IN THE CURRENT VIEW OF THE PAGE, THEN TRY TO SCROLL AND LOCATE IT.**
   - **AFTER EVERY ACTION, FETCH THE UPDATED VERSION OF THE SCREEN TO VERIFY WHETHER THE REQUIRED ACTION WAS EXECUTED OR NOT.**
   - **IF THE EXPECTED CHANGE IS NOT DETECTED, THEN RETRY THE ACTION OR ATTEMPT A RECOVERY PROCESS.**

4. **ELEMENT ID FETCHING**
   - **BEFORE EXECUTING ANY ACTION THAT REQUIRES AN ELEMENT ID, USE FETCH SCREEN TO IDENTIFY THE ID OF THE ELEMENT CORRECTLY.**
   - **ELEMENT IDs ARE DYNAMIC AND WILL CHANGE AFTER EACH FETCH REQUEST. SO ALWAYS FETCH THE LATEST SCREEN TO GET THE UPDATED ELEMENT ID.**
   - **ALWAYS INTERACT WITH THE CORRECT ELEMENT. THE ID USED TO INTERACT WITH THE ELEMENT MUST BE 100% ACCURATE.**
   - **USE VISION CAPABILITIES TO IDENTIFY THE ELEMENT AND IT'S ID CORRECTLY.**
   - **DO NOT INVOKE TOOL CALLS WITH WRONG ELEMENT ID.**

5. **INPUT HANDLING**
    - **BEFORE SENDING ANY INPUT, ENSURE THAT THE INPUT ELEMENT IS EMPTY. IF NOT, CLEAR THE VALUE OF THE ELEMENT FIRST.**
    - **WHEN SETTING THE VALUE FOR A SELECT ELEMENT, DO NOT USE ANY RANDOM VALUES. ALWAYS USE THE VALUES RETURNED BY getOptions TOOL.**

6. **SCROLL HANDLING**
   - **FIRST, MAKE SURE THAT ALL ELEMENTS NEEDED FOR A PARTICULAR ACTION IS PRESENT IN THE CURRENT VIEW OF THE PAGE.**
   - **THEN PERFORM THE ACTION ON THE ELEMENTS PRESENT IN THE CURRENT VIEW OF THE PAGE.**
   - **AFTER PERFORMING THAT ACTION, INITIATE A SCROLL, REFETCH THE PAGE AND PERFORM ACTIONS ON THE NEW SET OF ELEMENTS PRESENT IN THE NEW VIEW OF THE PAGE.**
   - **AFTER EACH SCROLL, FETCH THE UPDATED PAGE CONTENT AND IDENTIFY THE NEW ELEMENTS AND THEIR IDs.**

7. **NAVIGATE WEB PAGES EFFICIENTLY**
   - **WAIT FOR FULL PAGE LOAD** before interacting with elements.
   - **VERIFY NAVIGATION CHANGES** after clicking links or buttons before proceeding to the next step.
   - **IF UNEXPECTED BEHAVIOR OCCURS, ATTEMPT RECOVERY** (reload, navigate back, or retry).

8. **VALIDATE TASK COMPLETION STRICTLY BEFORE FINALIZING**
   - **AFTER EXECUTING AN ACTION, CONFIRM SUCCESS** by refetching the screen and checking the expected outcome on the latest screen.
   - **IF ACTION FAILS, ATTEMPT MULTIPLE RETRIES** before reporting failure.

9. **RESPOND ACCURATELY TO PAGE CONTENT REQUESTS**
   - **WHEN ASKED ABOUT PAGE CONTENT, ALWAYS GIVE AN INITIAL RESPONSE AND THEN RETRIEVE IT BY FETCHING.**
   - **PROVIDE A BRIEF, CLEAR SUMMARY** of visible elements (buttons, forms, images) while **EXCLUDING TECHNICAL DETAILS** like internal element IDs or hidden attributes.

### STRICTLY AVOID THE FOLLOWING ###
**DO NOT USE INVALID OR WRONG ELEMENT IDs** - Always fetch the latest screen to identify the latest ID of the elements and use it for executing actions.
**DO NOT GUESS ELEMENT IDs** - Extract all element IDs from the fetch screen, Do not hallucinate or guess the IDs.
**DO NOT EXPOSE INTERNAL PAGE DETAILS** - Never reveal hidden attributes, internal image URLs, or metadata.
**DO NOT EXECUTE ACTIONS WITHOUT VERIFYING PAGE CONTEXT** - Ensure an action is actually applicable before attempting it.
**DO NOT PERFORM ANY ACTIONS UNTIL THE PAGE HAS FULLY LOADED.** - Always wait for the page to load before initiating any actions.
**DO NOT EXECUTE MULTIPLE ACTIONS WITHOUT REFETCHING THE PAGE AFTER EACH ACTION.** - Always refetch the latest page after each action.
**DO NOT LEAVE TASKS INCOMPLETE** - If an action fails, retry multiple times before reporting failure.
**DO NOT INTERRUPT WITH UNNECESSARY CONFIRMATIONS** - Execute steps automatically unless clarification is required.

**IMPORTANT: ALWAYS GIVE A BRIEF DESCRIPTION ABOUT THE ACTION BEFORE EXECUTING ANY TOOL CALLS.**

</SYSTEM_PROMPT>"""

T1_TOOLS = [
    {
        "type": "function",
        "name": "getSteps",
        "description": "Get the steps to complete the task.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False
        }
    },
]

T3_TOOLS = [
    {
        "type": "function",
        "name": "fetchScreen",
        "description": "Get the current page screenshot as annotated image.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "click",
        "description": "Simulate a click on the specified DOM element.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "elementId": {
                    "type": "number",
                    "description": "The ID of the input element. DO NOT USE ANY RANDOM ID."
                }
            },
            "required": ["elementId"],
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "typeText",
        "description": "Type text into the specified element.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "elementId": {
                    "type": "number",
                    "description": "The ID of the input element. DO NOT USE ANY RANDOM ID."
                },
                "text": {
                    "type": "string",
                    "description": "The text to type"
                }
            },
            "required": ["elementId", "text"],
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "clearValue",
        "description": "Clears the value in the specified input element.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "elementId": {
                    "type": "number",
                    "description": "The ID of the input element. DO NOT USE ANY RANDOM ID."
                },
            },
            "required": ["elementId"],
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "keyPress",
        "description": "Send key press to the page.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "enum": ["Enter", "Backspace", "Delete", "Tab", "Escape", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown"],
                    "description": "The key to press"
                }
            },
            "required": ["key"],
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "getOption",
        "description": "Get all available options for the specified select element.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "elementId": {
                    "type": "number",
                    "description": "The ID of the specific element. DO NOT USE ANY RANDOM ID."
                }
            },
            "required": ["elementId"],
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "setOption",
        "description": "Set the value of a specified select element. Before setting the value, fetch the available options first.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "elementId": {
                    "type": "number",
                    "description": "The ID of the input element. DO NOT USE ANY RANDOM ID."
                },
                "value": {
                    "type": "string",
                    "description": "The value to set. USE THE VALUES RETURNED BY getOptions TOOL."
                }
            },
            "required": ["elementId", "value"],
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "loadingState",
        "description": "Check whether the page is loading or not.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "goto",
        "description": "Navigate to a given URL in current tab.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL to navigate to."
                }
            },
            "required": ["url"],
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "open",
        "description": "Navigate to a given URL in new tab.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL to navigate to."
                }
            },
            "required": ["url"],
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "close",
        "description": "Closes the current tab.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "reload",
        "description": "Reloads the current tab.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "checkScrollbar",
        "description": "Check whether the page is scrollable or not. Returns scroll position if it is scrollable.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "scroll",
        "description": "Scrolls the page in the specified direction and returns the current scrollbar position.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "direction": {
                    "type": "string",
                    "enum": ["up", "down", "left", "right"],
                    "description": "The direction to scroll"
                }
            },
            "required": ["direction"],
            "additionalProperties": False
        }
    },
    {
        "type": "function",
        "name": "wait",
        "description": "Wait for a specified amount of time.",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "ms": {
                    "type": "number",
                    "description": "The amount of time to wait in milliseconds"
                }
            },
            "required": ["ms"],
            "additionalProperties": False
        }
    },
]