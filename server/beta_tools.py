from enum import Enum
from pydantic import BaseModel, Field

# T1
class proceed(BaseModel):
    """Proceed to execution model."""
    task: str = Field(..., description="Generated task.")

T1_TOOLS = [
    proceed
]

# T2
class KEYS(str, Enum):
    Enter = "Enter"
    Backspace = "Backspace"
    Delete = "Delete"
    Tab = "Tab"
    Escape = "Escape"
    Space = "Space"
    ArrowUp = "ArrowUp"
    ArrowDown = "ArrowDown"
    ArrowLeft = "ArrowLeft"
    ArrowRight = "ArrowRight"
    PageUp = "PageUp"
    PageDown = "PageDown"

class fetchScreen(BaseModel):
    """Get the current page screenshot as annotated image."""

class click(BaseModel):
    """Simulate a click on the specified DOM element."""
    elementId: int = Field(..., description="The ID of the input element. DO NOT USE ANY RANDOM ID.")

class typeText(BaseModel):
    """Type text into the specified element."""
    elementId: int = Field(..., description="The ID of the input element. DO NOT USE ANY RANDOM ID.")
    text: str = Field(..., description="The text to type")

class clearValue(BaseModel):
    """Clears the value in the specified input element."""
    elementId: int = Field(..., description="The ID of the text that you want to clear. DO NOT USE ANY RANDOM ID.")

class keyPress(BaseModel):
    """Send key press to the page."""
    key: KEYS = Field(..., description="The key to press")

class getOption(BaseModel):
    """Get all available options for the specified select element."""
    elementId: int = Field(..., description="The ID of the specific element. DO NOT USE ANY RANDOM ID.")

class setOption(BaseModel):
    """Set the value of a specified select element. Before setting the value, fetch the available options first."""
    elementId: int = Field(..., description="The ID of the input element. DO NOT USE ANY RANDOM ID.")
    value: str = Field(..., description="The value to set. USE THE VALUES RETURNED BY getOptions TOOL.")

class getScrollPortions(BaseModel):
    """Get an image of the current page with a grid overlay highlighting the scrollable portions with a unique ID."""

class scroll(BaseModel):
    """Scrolls the portion of the page in the specified x and y distance. Use `getScrollPortions()` to get the portion ID."""
    portionId: int = Field(..., description="The ID of the portion. DO NOT USE ANY RANDOM ID. USE THE ID FROM `getScrollPortions()` TOOL.")
    xDistance: int = Field(..., description="The distance to scroll along the X axis (pixels).")
    yDistance: int = Field(..., description="The distance to scroll along the Y axis (pixels).")

class loadingState(BaseModel):
    """Check whether the page is loading or not."""

class goto(BaseModel):
    """Navigate to a given URL in current tab."""
    url: str = Field(..., description="The URL to navigate to.")

class getOpenedTabs(BaseModel):
    """Get the info of all opened tabs in json format."""

class openTab(BaseModel):
    """Opens a new tab with the specified URL."""
    url: str = Field(..., description="The URL to navigate to.")

class switchTab(BaseModel):
    """Switches to the specified tab."""
    tabId: int = Field(..., description="The ID of the tab to switch to. USE THE ID FROM `getOpenTabs()` TOOL.")

class closeTab(BaseModel):
    """Closes the specified tab."""
    tabId: int = Field(..., description="The ID of the tab to close. USE THE ID FROM `getOpenTabs()` TOOL.")

class reload(BaseModel):
    """Reloads the current tab."""

class wait(BaseModel):
    """Wait for a specified amount of time."""
    ms: int = Field(..., description="The amount of time to wait in milliseconds.")

T2_TOOLS = [
    fetchScreen,
    click,
    typeText,
    clearValue,
    keyPress,
    getOption,
    setOption,
    getScrollPortions,
    scroll,
    loadingState,
    goto,
    getOpenedTabs,
    openTab,
    switchTab,
    closeTab,
    reload,
    wait
]

# T3
class success(BaseModel):
    """Call when validation is successful."""

class failed(BaseModel):
    """Call when validation fails."""

class suspended(BaseModel):
    """Call when the task is suspended."""

T3_TOOLS = [
    success,
    failed,
    suspended
]