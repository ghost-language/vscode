// @ts-check
'use strict';

/**
 * The Lumen game engine's surface.
 *
 * Lumen is a 2D engine that a game drives entirely from Ghost, so there is no
 * separate Lumen syntax — a Lumen game is `.ghost` files. What Lumen adds is a
 * set of modules registered before the game runs, a handful of object types its
 * loaders hand back, and the callbacks the engine looks for by name.
 *
 * Transcribed from `modules/` (what is registered), `engine/` (the `Method`
 * switch on each object type and the callback names in `events.go`), and the
 * signatures documented in Lumen's README.
 */

/** @typedef {import('./types').Member} Member */
/** @typedef {import('./types').Module} Module */
/** @typedef {import('./types').ObjectType} ObjectType */
/** @typedef {import('./types').Callback} Callback */

/** Shared tail on every draw call that goes through the transform stack. */
const DRAW_TAIL = 'Rotation is in radians, applied about the origin offset `(ox, oy)`. Negative scale flips: `-1` for `sx` mirrors horizontally.';

/** @type {Module[]} */
const MODULES = [
	{
		name: 'canvas',
		source: 'lumen',
		doc: 'Drawing, the drawing state, and the transform stack.',
		members: [
			{ name: 'width', kind: 'property', signature: 'canvas.width', returns: 'Number', doc: 'The width being drawn into — the render target\'s when one is set, the window\'s otherwise.' },
			{ name: 'height', kind: 'property', signature: 'canvas.height', returns: 'Number', doc: 'The height being drawn into — the render target\'s when one is set, the window\'s otherwise.' },

			{ name: 'rectangle', kind: 'method', signature: 'canvas.rectangle(x, y, w, h)', doc: 'Draws a rectangle outline.' },
			{ name: 'filledRectangle', kind: 'method', signature: 'canvas.filledRectangle(x, y, w, h)', doc: 'Draws a filled rectangle.' },
			{ name: 'circle', kind: 'method', signature: 'canvas.circle(x, y, r, [segments])', doc: 'Draws a circle outline centred on `(x, y)`.' },
			{ name: 'filledCircle', kind: 'method', signature: 'canvas.filledCircle(x, y, r, [segments])', doc: 'Draws a filled circle centred on `(x, y)`.' },
			{ name: 'ellipse', kind: 'method', signature: 'canvas.ellipse(x, y, rx, ry, [segments])', doc: 'Draws an ellipse outline.' },
			{ name: 'filledEllipse', kind: 'method', signature: 'canvas.filledEllipse(x, y, rx, ry, [segments])', doc: 'Draws a filled ellipse.' },
			{ name: 'arc', kind: 'method', signature: 'canvas.arc(x, y, r, startAngle, endAngle, [segments])', doc: 'Draws an arc outline. Angles are in radians.' },
			{ name: 'filledArc', kind: 'method', signature: 'canvas.filledArc(x, y, r, startAngle, endAngle, [segments])', doc: 'Draws a filled arc. Angles are in radians.' },
			{ name: 'polygon', kind: 'method', signature: 'canvas.polygon(x1, y1, x2, y2, x3, y3, ...)', doc: 'Draws a polygon outline, from alternating coordinates or from one list of them.' },
			{ name: 'filledPolygon', kind: 'method', signature: 'canvas.filledPolygon(x1, y1, x2, y2, x3, y3, ...)', doc: 'Draws a filled polygon, from alternating coordinates or from one list of them.' },
			{ name: 'line', kind: 'method', signature: 'canvas.line(x1, y1, x2, y2, ...)', doc: 'Draws a line through any number of points.' },
			{ name: 'point', kind: 'method', signature: 'canvas.point(x, y, ...)', doc: 'Draws one or more points.' },

			{ name: 'clear', kind: 'method', signature: 'canvas.clear([color])', doc: 'Clears what is being drawn into.' },
			{ name: 'setColor', kind: 'method', signature: 'canvas.setColor(color)', doc: 'Sets the drawing colour. Takes a colour, or `r, g, b, [a]` components.' },
			{ name: 'getColor', kind: 'method', signature: 'canvas.getColor()', returns: 'Color', doc: 'The current drawing colour.' },
			{ name: 'setBackgroundColor', kind: 'method', signature: 'canvas.setBackgroundColor(color)', doc: 'Sets the colour the window is cleared to each frame.' },
			{ name: 'setLineWidth', kind: 'method', signature: 'canvas.setLineWidth(n)', doc: 'Sets the width of drawn lines and outlines.' },
			{ name: 'getLineWidth', kind: 'method', signature: 'canvas.getLineWidth()', returns: 'Number', doc: 'The current line width.' },
			{ name: 'setPointSize', kind: 'method', signature: 'canvas.setPointSize(n)', doc: 'Sets the size of drawn points.' },
			{ name: 'setBlendMode', kind: 'method', signature: "canvas.setBlendMode('alpha'|'add'|'multiply'|'none')", doc: 'Sets how drawing combines with what is already there.' },
			{ name: 'setScissor', kind: 'method', signature: 'canvas.setScissor(x, y, w, h)', doc: 'Confines drawing to a rectangle.' },
			{ name: 'clearScissor', kind: 'method', signature: 'canvas.clearScissor()', doc: 'Removes the scissor rectangle.' },

			{ name: 'print', kind: 'method', signature: 'canvas.print(text, x, y, [rotation, sx, sy, ox, oy])', doc: 'Draws a line of text in the current font.' },
			{ name: 'printf', kind: 'method', signature: "canvas.printf(text, x, y, limit, ['left'|'center'|'right'], [rotation, sx, sy, ox, oy])", doc: 'Draws text wrapped to `limit` pixels wide and aligned within it.' },
			{ name: 'setFont', kind: 'method', signature: 'canvas.setFont(font)', doc: 'Sets the font text is drawn in.' },
			{ name: 'getFont', kind: 'method', signature: 'canvas.getFont()', returns: 'Font', doc: 'The current font.' },
			{ name: 'resetFont', kind: 'method', signature: 'canvas.resetFont()', doc: 'Restores the built-in font.' },

			{ name: 'push', kind: 'method', signature: "canvas.push(['all'])", doc: 'Saves the current transform. `push(\'all\')` saves the drawing state with it.' },
			{ name: 'pop', kind: 'method', signature: 'canvas.pop()', doc: 'Restores the transform saved by the matching `push()`.' },
			{ name: 'origin', kind: 'method', signature: 'canvas.origin()', doc: 'Resets the transform to the identity.' },
			{ name: 'translate', kind: 'method', signature: 'canvas.translate(x, y)', doc: 'Shifts everything drawn afterwards. This is how a camera is written.' },
			{ name: 'rotate', kind: 'method', signature: 'canvas.rotate(radians)', doc: 'Rotates everything drawn afterwards.' },
			{ name: 'scale', kind: 'method', signature: 'canvas.scale(x, [y])', doc: 'Scales everything drawn afterwards. One argument scales both axes.' },
			{ name: 'shear', kind: 'method', signature: 'canvas.shear(x, y)', doc: 'Shears everything drawn afterwards.' },
			{ name: 'toScreen', kind: 'method', signature: 'canvas.toScreen(x, y)', doc: 'Converts a point from world coordinates to screen coordinates.' },
			{ name: 'toWorld', kind: 'method', signature: 'canvas.toWorld(x, y)', doc: 'Converts a point from screen coordinates to world coordinates.' },
			{ name: 'getVisible', kind: 'method', signature: 'canvas.getVisible()', doc: 'The rectangle of the world currently on screen — what a tilemap needs to draw only the tiles in view.' },

			{ name: 'newTarget', kind: 'method', signature: 'canvas.newTarget(w, h)', returns: 'Target', doc: 'Creates an off-screen surface to draw into.' },
			{ name: 'setTarget', kind: 'method', signature: 'canvas.setTarget([target])', doc: 'Directs drawing into a target, or back to the window when called with nothing.\n\nSetting a target resets the transform, because a target is its own screen: `(0, 0)` is its corner, not the window\'s. Clearing it restores the window\'s transform.' },
			{ name: 'newQuad', kind: 'method', signature: 'canvas.newQuad(x, y, w, h)', returns: 'Quad', doc: 'Creates a quad — a rectangle of a texture.' },
			{ name: 'screenshot', kind: 'method', signature: 'canvas.screenshot(filename)', doc: 'Writes the current frame to an image file.' }
		]
	},
	{
		name: 'color',
		source: 'lumen',
		doc: 'Making colours, and a small named palette.',
		members: [
			{ name: 'rgb', kind: 'method', signature: 'color.rgb(r, g, b, [a])', returns: 'Color', doc: 'A colour from 0–255 components.' },
			{ name: 'rgba', kind: 'method', signature: 'color.rgba(r, g, b, [a])', returns: 'Color', doc: 'A colour from 0–255 components.' },
			{ name: 'hex', kind: 'method', signature: "color.hex('#ff8800')", returns: 'Color', doc: 'A colour from a hex string.' },
			{ name: 'hsl', kind: 'method', signature: 'color.hsl(h, s, l, [a])', returns: 'Color', doc: 'A colour from hue, saturation and lightness.' },

			{ name: 'black', kind: 'property', signature: 'color.black', returns: 'Color', doc: 'Black.' },
			{ name: 'white', kind: 'property', signature: 'color.white', returns: 'Color', doc: 'White.' },
			{ name: 'transparent', kind: 'property', signature: 'color.transparent', returns: 'Color', doc: 'Fully transparent.' },
			{ name: 'red', kind: 'property', signature: 'color.red', returns: 'Color', doc: 'Red.' },
			{ name: 'green', kind: 'property', signature: 'color.green', returns: 'Color', doc: 'Green.' },
			{ name: 'blue', kind: 'property', signature: 'color.blue', returns: 'Color', doc: 'Blue.' },
			{ name: 'yellow', kind: 'property', signature: 'color.yellow', returns: 'Color', doc: 'Yellow.' },
			{ name: 'orange', kind: 'property', signature: 'color.orange', returns: 'Color', doc: 'Orange.' },
			{ name: 'purple', kind: 'property', signature: 'color.purple', returns: 'Color', doc: 'Purple.' },
			{ name: 'cyan', kind: 'property', signature: 'color.cyan', returns: 'Color', doc: 'Cyan.' },
			{ name: 'magenta', kind: 'property', signature: 'color.magenta', returns: 'Color', doc: 'Magenta.' },
			{ name: 'brown', kind: 'property', signature: 'color.brown', returns: 'Color', doc: 'Brown.' },
			{ name: 'gray', kind: 'property', signature: 'color.gray', returns: 'Color', doc: 'Mid grey.' },
			{ name: 'lightGray', kind: 'property', signature: 'color.lightGray', returns: 'Color', doc: 'Light grey.' },
			{ name: 'darkGray', kind: 'property', signature: 'color.darkGray', returns: 'Color', doc: 'Dark grey.' }
		]
	},
	{
		name: 'image',
		source: 'lumen',
		doc: 'Loading textures and cutting them up.',
		members: [
			{ name: 'load', kind: 'method', signature: 'image.load(path)', returns: 'Image', doc: 'Loads an image. Paths resolve against the directory the entry file is in.\n\nLoading a path a second time hands back the texture already in memory, so loading one sheet from two places costs one texture.' },
			{ name: 'newQuad', kind: 'method', signature: 'image.newQuad(x, y, w, h)', returns: 'Quad', doc: 'Creates a quad — a rectangle of a texture.' },
			{ name: 'newSpritesheet', kind: 'method', signature: 'image.newSpritesheet(path, frameSize)', returns: 'Spritesheet', doc: 'Cuts an image into a grid of equally sized frames.\n\nTakes `frameSize` for square frames or `frameWidth, frameHeight`. The first argument may also be an image already loaded, which is how two sheets get cut from one file at different frame sizes.' }
		]
	},
	{
		name: 'font',
		source: 'lumen',
		doc: 'Loading fonts.',
		members: [
			{ name: 'load', kind: 'method', signature: 'font.load(path, size)', returns: 'Font', doc: 'Loads a TrueType font at a size. `load(size)` uses the built-in font.' },
			{ name: 'system', kind: 'method', signature: 'font.system([size])', returns: 'Font', doc: 'The built-in font at a size, or the current default when called with nothing.' }
		]
	},
	{
		name: 'audio',
		source: 'lumen',
		doc: 'Sound and music. WAV, OGG and MP3 are supported.',
		members: [
			{ name: 'newSource', kind: 'method', signature: "audio.newSource(path, ['static'|'stream'])", returns: 'Source', doc: 'Loads a sound.\n\n`\'static\'` decodes the whole sound up front and can overlap with itself — use it for effects. `\'stream\'` decodes while playing — use it for music.' },
			{ name: 'play', kind: 'method', signature: 'audio.play(source)', doc: 'Plays a source.' },
			{ name: 'stop', kind: 'method', signature: 'audio.stop([source])', doc: 'Stops one source, or everything.' },
			{ name: 'pause', kind: 'method', signature: 'audio.pause()', doc: 'Pauses all audio.' },
			{ name: 'resume', kind: 'method', signature: 'audio.resume()', doc: 'Resumes all audio.' },
			{ name: 'setVolume', kind: 'method', signature: 'audio.setVolume(volume)', doc: 'Sets the master volume, 0 to 1.' },
			{ name: 'getVolume', kind: 'method', signature: 'audio.getVolume()', returns: 'Number', doc: 'The master volume, 0 to 1.' }
		]
	},
	{
		name: 'keyboard',
		source: 'lumen',
		doc: 'Keyboard state.\n\nEach query takes any number of key names and is true if any of them matches, so one action binds to several keys: `keyboard.isDown(\'left\', \'a\')`. Names are SDL key names, matched case-insensitively; an unrecognised name is an error rather than a silent false.',
		members: [
			{ name: 'isDown', kind: 'method', signature: 'keyboard.isDown(key, ...)', returns: 'Boolean', doc: 'Whether any of these keys is held, true on **every frame** it is held.\n\nFor menus and dialogue use `keypressed()` instead, which fires once per physical press.' },
			{ name: 'isUp', kind: 'method', signature: 'keyboard.isUp(key, ...)', returns: 'Boolean', doc: 'Whether any of these keys is not held.' },
			{ name: 'wasPressed', kind: 'method', signature: 'keyboard.wasPressed(key, ...)', returns: 'Boolean', doc: 'Whether any of these keys went down this frame.' },
			{ name: 'wasReleased', kind: 'method', signature: 'keyboard.wasReleased(key, ...)', returns: 'Boolean', doc: 'Whether any of these keys came up this frame.' },
			{ name: 'startTextInput', kind: 'method', signature: 'keyboard.startTextInput()', doc: 'Begins text entry, after which typing raises `textinput()`.' },
			{ name: 'stopTextInput', kind: 'method', signature: 'keyboard.stopTextInput()', doc: 'Ends text entry.' },
			{ name: 'isTextInputActive', kind: 'method', signature: 'keyboard.isTextInputActive()', returns: 'Boolean', doc: 'Whether text entry is active.' }
		]
	},
	{
		name: 'mouse',
		source: 'lumen',
		doc: "Pointer state. Buttons are `'left'`, `'middle'`, `'right'`, `'x1'`, `'x2'`.",
		members: [
			{ name: 'x', kind: 'property', signature: 'mouse.x', returns: 'Number', doc: 'The pointer\'s x position, in the coordinates the game draws in.' },
			{ name: 'y', kind: 'property', signature: 'mouse.y', returns: 'Number', doc: 'The pointer\'s y position, in the coordinates the game draws in.' },
			{ name: 'wheel', kind: 'property', signature: 'mouse.wheel', returns: 'Number', doc: 'Vertical wheel movement this frame.' },
			{ name: 'wheelX', kind: 'property', signature: 'mouse.wheelX', returns: 'Number', doc: 'Horizontal wheel movement this frame.' },
			{ name: 'isButtonDown', kind: 'method', signature: 'mouse.isButtonDown(button)', returns: 'Boolean', doc: 'Whether a button is held.' },
			{ name: 'isButtonUp', kind: 'method', signature: 'mouse.isButtonUp(button)', returns: 'Boolean', doc: 'Whether a button is not held.' },
			{ name: 'wasButtonPressed', kind: 'method', signature: 'mouse.wasButtonPressed(button)', returns: 'Boolean', doc: 'Whether a button went down this frame.' },
			{ name: 'wasButtonReleased', kind: 'method', signature: 'mouse.wasButtonReleased(button)', returns: 'Boolean', doc: 'Whether a button came up this frame.' },
			{ name: 'getPosition', kind: 'method', signature: 'mouse.getPosition()', doc: 'The pointer position.' },
			{ name: 'setPosition', kind: 'method', signature: 'mouse.setPosition(x, y)', doc: 'Moves the pointer.' },
			{ name: 'getWorldPosition', kind: 'method', signature: 'mouse.getWorldPosition()', doc: 'The pointer position through the current transform — where it is in the world, not on the screen.' },
			{ name: 'showCursor', kind: 'method', signature: 'mouse.showCursor()', doc: 'Shows the system cursor.' },
			{ name: 'hideCursor', kind: 'method', signature: 'mouse.hideCursor()', doc: 'Hides the system cursor.' },
			{ name: 'isVisible', kind: 'method', signature: 'mouse.isVisible()', returns: 'Boolean', doc: 'Whether the system cursor is shown.' },
			{ name: 'setRelativeMode', kind: 'method', signature: 'mouse.setRelativeMode(enabled)', doc: 'Locks the pointer and reports movement instead of position.' },
			{ name: 'setGrabbed', kind: 'method', signature: 'mouse.setGrabbed(grabbed)', doc: 'Confines the pointer to the window.' }
		]
	},
	{
		name: 'joystick',
		source: 'lumen',
		doc: "Game controllers, numbered from 1.\n\nButtons use SDL game-controller names: `'a'`, `'b'`, `'x'`, `'y'`, `'start'`, `'back'`, `'guide'`, `'leftshoulder'`, `'rightshoulder'`, `'leftstick'`, `'rightstick'`, `'dpup'`, `'dpdown'`, `'dpleft'`, `'dpright'`. Axes are `'leftx'`, `'lefty'`, `'rightx'`, `'righty'`, `'triggerleft'`, `'triggerright'`.\n\nChecking a controller that is not plugged in reads as \"not pressed\" rather than raising.",
		members: [
			{ name: 'count', kind: 'property', signature: 'joystick.count', returns: 'Number', doc: 'How many controllers are connected.' },
			{ name: 'isDown', kind: 'method', signature: 'joystick.isDown(index, button)', returns: 'Boolean', doc: 'Whether a button is held.' },
			{ name: 'isUp', kind: 'method', signature: 'joystick.isUp(index, button)', returns: 'Boolean', doc: 'Whether a button is not held.' },
			{ name: 'wasPressed', kind: 'method', signature: 'joystick.wasPressed(index, button)', returns: 'Boolean', doc: 'Whether a button went down this frame.' },
			{ name: 'wasReleased', kind: 'method', signature: 'joystick.wasReleased(index, button)', returns: 'Boolean', doc: 'Whether a button came up this frame.' },
			{ name: 'getAxis', kind: 'method', signature: 'joystick.getAxis(index, axis, [deadZone])', returns: 'Number', doc: 'An axis reading. Sticks report -1 to 1 and triggers 0 to 1, with a 0.15 dead zone by default.' },
			{ name: 'getName', kind: 'method', signature: 'joystick.getName(index)', returns: 'String', doc: 'The controller\'s name.' },
			{ name: 'isConnected', kind: 'method', signature: 'joystick.isConnected(index)', returns: 'Boolean', doc: 'Whether that controller is plugged in.' },
			{ name: 'vibrate', kind: 'method', signature: 'joystick.vibrate(index, strength, [strength2], [seconds])', doc: 'Rumbles the controller.' }
		]
	},
	{
		name: 'timer',
		source: 'lumen',
		doc: 'Frame timing.',
		members: [
			{ name: 'delta', kind: 'property', signature: 'timer.delta', returns: 'Number', doc: 'How many seconds the previous frame took — the same value `update(dt)` receives.' },
			{ name: 'averageDelta', kind: 'property', signature: 'timer.averageDelta', returns: 'Number', doc: 'A running average of frame time.' },
			{ name: 'fps', kind: 'property', signature: 'timer.fps', returns: 'Number', doc: 'The current frame rate.' },
			{ name: 'time', kind: 'property', signature: 'timer.time', returns: 'Number', doc: 'Seconds since the game started.' },
			{ name: 'frame', kind: 'property', signature: 'timer.frame', returns: 'Number', doc: 'How many frames have been drawn.' },
			{ name: 'getDelta', kind: 'method', signature: 'timer.getDelta()', returns: 'Number', doc: 'How many seconds the previous frame took.' },
			{ name: 'getFps', kind: 'method', signature: 'timer.getFps()', returns: 'Number', doc: 'The current frame rate.' },
			{ name: 'getTime', kind: 'method', signature: 'timer.getTime()', returns: 'Number', doc: 'Seconds since the game started.' },
			{ name: 'sleep', kind: 'method', signature: 'timer.sleep(seconds)', doc: 'Pauses. This stalls the frame — rarely what a game loop wants.' }
		]
	},
	{
		name: 'window',
		source: 'lumen',
		doc: 'The game window, and the space the game draws in.',
		members: [
			{ name: 'width', kind: 'property', signature: 'window.width', returns: 'Number', doc: 'The width the game draws in — the logical size when one is set, the window\'s otherwise.' },
			{ name: 'height', kind: 'property', signature: 'window.height', returns: 'Number', doc: 'The height the game draws in — the logical size when one is set, the window\'s otherwise.' },
			{ name: 'scale', kind: 'property', signature: 'window.scale', returns: 'Number', doc: 'How many screen pixels one game pixel currently covers.' },
			{ name: 'title', kind: 'property', signature: 'window.title', returns: 'String', doc: 'The window title.' },
			{ name: 'fps', kind: 'property', signature: 'window.fps', returns: 'Number', doc: 'The current frame rate.' },
			{ name: 'fullscreen', kind: 'property', signature: 'window.fullscreen', returns: 'Boolean', doc: 'Whether the window is fullscreen.' },
			{ name: 'focused', kind: 'property', signature: 'window.focused', returns: 'Boolean', doc: 'Whether the window has focus.' },
			{ name: 'setTitle', kind: 'method', signature: 'window.setTitle(title)', doc: 'Sets the window title.' },
			{ name: 'setMode', kind: 'method', signature: 'window.setMode(w, h, [fullscreen])', doc: 'Sets the window size and fullscreen state together.' },
			{ name: 'setSize', kind: 'method', signature: 'window.setSize(w, h)', doc: 'Resizes the window.' },
			{ name: 'setLogicalSize', kind: 'method', signature: 'window.setLogicalSize(w, h)', doc: 'Fixes the space the game draws in, letting Lumen scale it to fit the window, keep its proportions, centre it, and letterbox the rest.\n\nThis is what keeps a bigger window from simply showing more of the world. Mouse positions arrive in these coordinates too, so nothing else in the game has to know scaling is happening.' },
			{ name: 'clearLogicalSize', kind: 'method', signature: 'window.clearLogicalSize()', doc: 'Goes back to drawing in window pixels.' },
			{ name: 'getLogicalSize', kind: 'method', signature: 'window.getLogicalSize()', doc: 'The logical size, when one is set.' },
			{ name: 'setPixelPerfect', kind: 'method', signature: 'window.setPixelPerfect(enabled)', doc: 'Rounds the scale down to a whole number, which is what keeps pixel art from developing uneven edges. It costs more of the screen to the bars; worth it for a small canvas, not for a large one.' },
			{ name: 'setFullscreen', kind: 'method', signature: 'window.setFullscreen(enabled)', doc: 'Enters or leaves fullscreen.' },
			{ name: 'toggleFullscreen', kind: 'method', signature: 'window.toggleFullscreen()', doc: 'Flips the fullscreen state.' },
			{ name: 'setResizable', kind: 'method', signature: 'window.setResizable(enabled)', doc: 'Allows or prevents resizing.' },
			{ name: 'setBorderless', kind: 'method', signature: 'window.setBorderless(enabled)', doc: 'Removes or restores the window border.' },
			{ name: 'setVsync', kind: 'method', signature: 'window.setVsync(enabled)', doc: 'Turns vertical sync on or off.' },
			{ name: 'setIcon', kind: 'method', signature: 'window.setIcon(image)', doc: 'Sets the window icon.' },
			{ name: 'setPosition', kind: 'method', signature: 'window.setPosition(x, y)', doc: 'Moves the window.' },
			{ name: 'center', kind: 'method', signature: 'window.center()', doc: 'Centres the window on the desktop.' },
			{ name: 'maximize', kind: 'method', signature: 'window.maximize()', doc: 'Maximises the window.' },
			{ name: 'minimize', kind: 'method', signature: 'window.minimize()', doc: 'Minimises the window.' },
			{ name: 'restore', kind: 'method', signature: 'window.restore()', doc: 'Restores a maximised or minimised window.' },
			{ name: 'getDimensions', kind: 'method', signature: 'window.getDimensions()', doc: 'The real window size, whatever the logical size is.' },
			{ name: 'getDesktopDimensions', kind: 'method', signature: 'window.getDesktopDimensions()', doc: 'The desktop resolution.' }
		]
	},
	{
		name: 'filesystem',
		source: 'lumen',
		doc: "Saved games, in the player's own data directory rather than next to the program — a game installed read-only cannot write to its own folder.\n\nSaves land in `~/.local/share/lumen/<identity>` on Linux, `~/Library/Application Support/lumen/<identity>` on macOS, and `%AppData%\\lumen\\<identity>` on Windows. Save paths cannot escape the save directory.",
		members: [
			{ name: 'setIdentity', kind: 'method', signature: 'filesystem.setIdentity(name)', doc: 'Names the game\'s save directory. Call once, in `load()`.' },
			{ name: 'getSaveDirectory', kind: 'method', signature: 'filesystem.getSaveDirectory()', returns: 'String', doc: 'The full path saves are written to.' },
			{ name: 'read', kind: 'method', signature: 'filesystem.read(name)', returns: 'String', doc: 'Reads a saved file, returning **null** when it does not exist — so "no save yet" is an ordinary case rather than an error.' },
			{ name: 'write', kind: 'method', signature: 'filesystem.write(name, contents)', doc: 'Writes a saved file, replacing what was there.' },
			{ name: 'append', kind: 'method', signature: 'filesystem.append(name, contents)', doc: 'Appends to a saved file.' },
			{ name: 'exists', kind: 'method', signature: 'filesystem.exists(name)', returns: 'Boolean', doc: 'Whether a saved file exists.' },
			{ name: 'remove', kind: 'method', signature: 'filesystem.remove(name)', doc: 'Deletes a saved file.' },
			{ name: 'createDirectory', kind: 'method', signature: 'filesystem.createDirectory(name)', doc: 'Creates a directory inside the save directory.' },
			{ name: 'getDirectoryItems', kind: 'method', signature: 'filesystem.getDirectoryItems([name])', returns: 'List', doc: 'Lists what is in the save directory.' },
			{ name: 'readAsset', kind: 'method', signature: 'filesystem.readAsset(path)', returns: 'String', doc: 'Reads a file shipped with the game, resolved against the game\'s own directory. The read-only counterpart to `read()` — use it for maps, dialogue and other shipped data.' }
		]
	},
	{
		name: 'system',
		source: 'lumen',
		doc: 'The host machine.',
		members: [
			{ name: 'os', kind: 'property', signature: 'system.os', returns: 'String', doc: 'The operating system\'s name.' },
			{ name: 'processorCount', kind: 'property', signature: 'system.processorCount', returns: 'Number', doc: 'How many logical processors the machine has.' },
			{ name: 'getClipboardText', kind: 'method', signature: 'system.getClipboardText()', returns: 'String', doc: 'The clipboard contents.' },
			{ name: 'setClipboardText', kind: 'method', signature: 'system.setClipboardText(text)', doc: 'Puts text on the clipboard.' },
			{ name: 'openUrl', kind: 'method', signature: 'system.openUrl(url)', doc: 'Opens a URL in the default browser. http and https only.' },
			{ name: 'getPowerInfo', kind: 'method', signature: 'system.getPowerInfo()', doc: 'Battery state and charge.' }
		]
	},
	{
		name: 'lumen',
		source: 'lumen',
		doc: 'The engine itself.',
		members: [
			{ name: 'version', kind: 'property', signature: 'lumen.version', returns: 'String', doc: 'The running engine\'s version string.' },
			{ name: 'quit', kind: 'method', signature: 'lumen.quit()', doc: 'Ends the game. The loop finishes the frame it is in first, so a game never stops halfway through drawing.' },
			{ name: 'setTargetFps', kind: 'method', signature: 'lumen.setTargetFps(fps)', doc: 'Caps the frame rate. Zero removes the cap and lets the game run as fast as vsync allows.' },
			{ name: 'getTargetFps', kind: 'method', signature: 'lumen.getTargetFps()', returns: 'Number', doc: 'The frame rate cap, or zero when uncapped.' }
		]
	}
];

/**
 * What Lumen adds to Ghost's own `math` module. These are merged into it
 * rather than exposed separately, matching how the engine registers them.
 *
 * @type {Member[]}
 */
const MATH_EXTENSIONS = [
	{ name: 'floor', kind: 'method', signature: 'math.floor(n)', returns: 'Number', doc: 'The largest whole number no greater than `n`.', source: 'lumen' },
	{ name: 'ceil', kind: 'method', signature: 'math.ceil(n)', returns: 'Number', doc: 'The smallest whole number no less than `n`.', source: 'lumen' },
	{ name: 'round', kind: 'method', signature: 'math.round(n)', returns: 'Number', doc: '`n` rounded to the nearest whole number.', source: 'lumen' },
	{ name: 'sqrt', kind: 'method', signature: 'math.sqrt(n)', returns: 'Number', doc: 'The square root of `n`.', source: 'lumen' },
	{ name: 'pow', kind: 'method', signature: 'math.pow(base, exponent)', returns: 'Number', doc: '`base` raised to `exponent`.', source: 'lumen' },
	{ name: 'exp', kind: 'method', signature: 'math.exp(n)', returns: 'Number', doc: 'e raised to `n`.', source: 'lumen' },
	{ name: 'log', kind: 'method', signature: 'math.log(n)', returns: 'Number', doc: 'The natural logarithm of `n`.', source: 'lumen' },
	{ name: 'sign', kind: 'method', signature: 'math.sign(n)', returns: 'Number', doc: '-1, 0 or 1, according to the sign of `n`.', source: 'lumen' },
	{ name: 'asin', kind: 'method', signature: 'math.asin(n)', returns: 'Number', doc: 'The arcsine of `n`, in radians.', source: 'lumen' },
	{ name: 'acos', kind: 'method', signature: 'math.acos(n)', returns: 'Number', doc: 'The arccosine of `n`, in radians.', source: 'lumen' },
	{ name: 'atan', kind: 'method', signature: 'math.atan(n)', returns: 'Number', doc: 'The arctangent of `n`, in radians.', source: 'lumen' },
	{ name: 'atan2', kind: 'method', signature: 'math.atan2(y, x)', returns: 'Number', doc: 'The angle of the vector `(x, y)`, in radians, with the quadrant resolved.', source: 'lumen' },
	{ name: 'degrees', kind: 'method', signature: 'math.degrees(radians)', returns: 'Number', doc: 'Radians converted to degrees.', source: 'lumen' },
	{ name: 'radians', kind: 'method', signature: 'math.radians(degrees)', returns: 'Number', doc: 'Degrees converted to radians.', source: 'lumen' },
	{ name: 'clamp', kind: 'method', signature: 'math.clamp(value, low, high)', returns: 'Number', doc: '`value` held between `low` and `high`.', source: 'lumen' },
	{ name: 'lerp', kind: 'method', signature: 'math.lerp(from, to, amount)', returns: 'Number', doc: 'A point `amount` of the way from `from` to `to`.', source: 'lumen' },
	{ name: 'distance', kind: 'method', signature: 'math.distance(x1, y1, x2, y2)', returns: 'Number', doc: 'The distance between two points.', source: 'lumen' },
	{ name: 'angle', kind: 'method', signature: 'math.angle(x1, y1, x2, y2)', returns: 'Number', doc: 'The angle from one point to another, in radians.', source: 'lumen' },
	{ name: 'random', kind: 'method', signature: 'math.random([low], [high])', returns: 'Number', doc: 'A random number: 0 to 1 with no arguments, 1 to `n` with one, `low` to `high` with two.\n\nDraws on a generator kept separate from the global one, so seeding it for reproducible level generation cannot be disturbed by anything else.', source: 'lumen' },
	{ name: 'randomSeed', kind: 'method', signature: 'math.randomSeed(n)', doc: 'Seeds the generator, making the sequence that follows repeatable.', source: 'lumen' },
	{ name: 'noise', kind: 'method', signature: 'math.noise(x, [y])', returns: 'Number', doc: 'Smoothly varying noise — for terrain, clouds and other things that should look organic rather than random.', source: 'lumen' }
];

/** @type {ObjectType[]} */
const TYPES = [
	{
		name: 'Image',
		source: 'lumen',
		doc: 'A loaded texture. Returned by `image.load()`.',
		methods: [
			{ name: 'draw', kind: 'method', signature: 'draw(x, y, [rotation, sx, sy, ox, oy])', doc: 'Draws the image.\n\n' + DRAW_TAIL },
			{ name: 'drawQuad', kind: 'method', signature: 'drawQuad(quad, x, y, [rotation, sx, sy, ox, oy])', doc: 'Draws one rectangle of the image.\n\n' + DRAW_TAIL },
			{ name: 'clip', kind: 'method', signature: 'clip(x, y, w, h)', returns: 'Image', doc: 'A lightweight view onto part of the image — how one spritesheet becomes many sprites. Also takes `clip(x, y, size)` for a square.' },
			{ name: 'getWidth', kind: 'method', signature: 'getWidth()', returns: 'Number', doc: 'The image width in pixels.' },
			{ name: 'getHeight', kind: 'method', signature: 'getHeight()', returns: 'Number', doc: 'The image height in pixels.' },
			{ name: 'getDimensions', kind: 'method', signature: 'getDimensions()', doc: 'The image width and height.' },
			{ name: 'getPixel', kind: 'method', signature: 'getPixel(x, y)', returns: 'Color', doc: 'Reads a pixel from the source image, which lets collision or spawn data be baked into a map image.' },
			{ name: 'setFilter', kind: 'method', signature: "setFilter('nearest'|'linear')", doc: 'How the image is sampled when scaled. `\'nearest\'` for pixel art.' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'A description of the image.' }
		]
	},
	{
		name: 'Spritesheet',
		source: 'lumen',
		doc: 'One image cut into a grid of equally sized frames, numbered left to right and top to bottom **from zero**. The quads are built once, when the sheet is made, so drawing a frame never allocates.',
		methods: [
			{ name: 'draw', kind: 'method', signature: 'draw(frame, x, y, [rotation, sx, sy, ox, oy])', doc: 'Draws one frame.\n\n' + DRAW_TAIL },
			{ name: 'newAnimation', kind: 'method', signature: "newAnimation(frames, secondsPerFrame, ['loop'|'once'|'pingpong'])", returns: 'Animation', doc: 'A sequence of this sheet\'s frames played against a clock.\n\n```ghost\nwalk = sheet.newAnimation([4, 5, 6, 7], 0.16)\n```' },
			{ name: 'getQuad', kind: 'method', signature: 'getQuad(frame)', returns: 'Quad', doc: 'The quad for one frame.' },
			{ name: 'getImage', kind: 'method', signature: 'getImage()', returns: 'Image', doc: 'The image the sheet was cut from.' },
			{ name: 'getCount', kind: 'method', signature: 'getCount()', returns: 'Number', doc: 'How many frames the sheet holds.' },
			{ name: 'getColumns', kind: 'method', signature: 'getColumns()', returns: 'Number', doc: 'How many frames across.' },
			{ name: 'getRows', kind: 'method', signature: 'getRows()', returns: 'Number', doc: 'How many frames down.' },
			{ name: 'getFrameWidth', kind: 'method', signature: 'getFrameWidth()', returns: 'Number', doc: 'One frame\'s width.' },
			{ name: 'getFrameHeight', kind: 'method', signature: 'getFrameHeight()', returns: 'Number', doc: 'One frame\'s height.' },
			{ name: 'getFrameDimensions', kind: 'method', signature: 'getFrameDimensions()', doc: 'One frame\'s width and height.' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'A description of the sheet.' }
		]
	},
	{
		name: 'Animation',
		source: 'lumen',
		doc: "A sequence of a spritesheet's frames played against a clock.\n\n**The clock is time, not frames drawn.** `secondsPerFrame` is what it says, so a walk cycle runs at the same speed on a machine managing 30 FPS as on one managing 144.\n\nEach animation carries its own playhead, so two characters showing the same walk cycle need one each — `clone()` is the cheap way to get one.",
		methods: [
			{ name: 'update', kind: 'method', signature: 'update([dt])', doc: 'Advances the playhead. Called with nothing it uses the last frame\'s time.' },
			{ name: 'draw', kind: 'method', signature: 'draw(x, y, [rotation, sx, sy, ox, oy])', doc: 'Draws the current frame.\n\n' + DRAW_TAIL },
			{ name: 'play', kind: 'method', signature: 'play()', doc: 'Starts playing from the beginning.' },
			{ name: 'pause', kind: 'method', signature: 'pause()', doc: 'Holds the current frame.' },
			{ name: 'resume', kind: 'method', signature: 'resume()', doc: 'Continues from where it was paused.' },
			{ name: 'stop', kind: 'method', signature: 'stop()', doc: 'Stops and rewinds.' },
			{ name: 'reset', kind: 'method', signature: 'reset()', doc: 'Returns the playhead to the start.' },
			{ name: 'seek', kind: 'method', signature: 'seek(seconds)', doc: 'Moves the playhead to a point in time — how a game that keeps its own clock drives an animation without calling `update()`.' },
			{ name: 'clone', kind: 'method', signature: 'clone()', returns: 'Animation', doc: 'A copy with its own playhead.' },
			{ name: 'isPlaying', kind: 'method', signature: 'isPlaying()', returns: 'Boolean', doc: 'Whether it is playing.' },
			{ name: 'isPaused', kind: 'method', signature: 'isPaused()', returns: 'Boolean', doc: 'Whether it is paused.' },
			{ name: 'isFinished', kind: 'method', signature: 'isFinished()', returns: 'Boolean', doc: 'Whether a `\'once\'` animation has reached its last frame. `\'loop\'` and `\'pingpong\'` never finish.' },
			{ name: 'getFrame', kind: 'method', signature: 'getFrame()', returns: 'Number', doc: 'The frame currently showing.' },
			{ name: 'getFrameCount', kind: 'method', signature: 'getFrameCount()', returns: 'Number', doc: 'How many frames the sequence holds.' },
			{ name: 'getElapsed', kind: 'method', signature: 'getElapsed()', returns: 'Number', doc: 'How far the playhead has travelled, in seconds.' },
			{ name: 'getLength', kind: 'method', signature: 'getLength()', returns: 'Number', doc: 'The sequence\'s total length in seconds.' },
			{ name: 'getSheet', kind: 'method', signature: 'getSheet()', returns: 'Spritesheet', doc: 'The spritesheet the frames come from.' },
			{ name: 'getDuration', kind: 'method', signature: 'getDuration()', returns: 'Number', doc: 'Seconds per frame.' },
			{ name: 'setDuration', kind: 'method', signature: 'setDuration(seconds)', doc: 'Sets seconds per frame. A duration of `0` holds the first frame, which is how a still pose is written.' },
			{ name: 'getSpeed', kind: 'method', signature: 'getSpeed()', returns: 'Number', doc: 'The playback rate.' },
			{ name: 'setSpeed', kind: 'method', signature: 'setSpeed(speed)', doc: 'Sets the playback rate. `-1` runs it backwards.' },
			{ name: 'getMode', kind: 'method', signature: 'getMode()', returns: 'String', doc: 'The loop mode.' },
			{ name: 'setMode', kind: 'method', signature: "setMode('loop'|'once'|'pingpong')", doc: 'Sets the loop mode.' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'A description of the animation.' }
		]
	},
	{
		name: 'Quad',
		source: 'lumen',
		doc: 'A rectangle of a texture. Building one per animation frame up front and reusing it beats allocating one per draw.',
		methods: [
			{ name: 'getX', kind: 'method', signature: 'getX()', returns: 'Number', doc: 'The rectangle\'s x position within the texture.' },
			{ name: 'getY', kind: 'method', signature: 'getY()', returns: 'Number', doc: 'The rectangle\'s y position within the texture.' },
			{ name: 'getWidth', kind: 'method', signature: 'getWidth()', returns: 'Number', doc: 'The rectangle\'s width.' },
			{ name: 'getHeight', kind: 'method', signature: 'getHeight()', returns: 'Number', doc: 'The rectangle\'s height.' },
			{ name: 'setViewport', kind: 'method', signature: 'setViewport(x, y, w, h)', doc: 'Moves the rectangle within the texture.' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'A description of the quad.' }
		]
	},
	{
		name: 'Font',
		source: 'lumen',
		doc: 'A loaded font.\n\nRendered strings are cached, so drawing the same text every frame costs almost nothing; text that changes every frame is evicted automatically.',
		methods: [
			{ name: 'print', kind: 'method', signature: 'print(text, x, y, [rotation, sx, sy, ox, oy])', doc: 'Draws a line of text in this font.' },
			{ name: 'printf', kind: 'method', signature: "printf(text, x, y, limit, ['left'|'center'|'right'], [rotation, sx, sy, ox, oy])", doc: 'Draws text wrapped to `limit` pixels wide.' },
			{ name: 'getWidth', kind: 'method', signature: 'getWidth(text)', returns: 'Number', doc: 'How wide a string renders — what centring text and sizing a dialogue box need.' },
			{ name: 'getHeight', kind: 'method', signature: 'getHeight()', returns: 'Number', doc: 'The font\'s height.' },
			{ name: 'getLineHeight', kind: 'method', signature: 'getLineHeight()', returns: 'Number', doc: 'The distance between baselines.' },
			{ name: 'setLineHeight', kind: 'method', signature: 'setLineHeight(n)', doc: 'Sets the distance between baselines.' },
			{ name: 'getAscent', kind: 'method', signature: 'getAscent()', returns: 'Number', doc: 'How far the font rises above the baseline.' },
			{ name: 'getDescent', kind: 'method', signature: 'getDescent()', returns: 'Number', doc: 'How far the font drops below the baseline.' },
			{ name: 'getBaseline', kind: 'method', signature: 'getBaseline()', returns: 'Number', doc: 'The baseline offset.' },
			{ name: 'getWrap', kind: 'method', signature: 'getWrap(text, limit)', returns: 'List', doc: 'The lines `text` would wrap into at `limit` pixels wide.' },
			{ name: 'getSize', kind: 'method', signature: 'getSize()', returns: 'Number', doc: 'The size the font was loaded at.' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'A description of the font.' }
		]
	},
	{
		name: 'Color',
		source: 'lumen',
		doc: 'A colour.',
		methods: [
			{ name: 'getRed', kind: 'method', signature: 'getRed()', returns: 'Number', doc: 'The red component, 0–255.' },
			{ name: 'getGreen', kind: 'method', signature: 'getGreen()', returns: 'Number', doc: 'The green component, 0–255.' },
			{ name: 'getBlue', kind: 'method', signature: 'getBlue()', returns: 'Number', doc: 'The blue component, 0–255.' },
			{ name: 'getAlpha', kind: 'method', signature: 'getAlpha()', returns: 'Number', doc: 'The alpha component, 0–255.' },
			{ name: 'toHex', kind: 'method', signature: 'toHex()', returns: 'String', doc: 'The colour as a hex string.' },
			{ name: 'withAlpha', kind: 'method', signature: 'withAlpha(alpha)', returns: 'Color', doc: 'The same colour at a different opacity, 0 to 1.' },
			{ name: 'lerp', kind: 'method', signature: 'lerp(other, amount)', returns: 'Color', doc: 'A colour `amount` of the way towards `other`.' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'A description of the colour.' }
		]
	},
	{
		name: 'Target',
		source: 'lumen',
		doc: 'An off-screen surface. Draw into it with `canvas.setTarget(target)`, return to the window with `canvas.setTarget()`, then draw it like any image.',
		methods: [
			{ name: 'draw', kind: 'method', signature: 'draw(x, y, [rotation, sx, sy, ox, oy])', doc: 'Draws the target.\n\n' + DRAW_TAIL },
			{ name: 'getWidth', kind: 'method', signature: 'getWidth()', returns: 'Number', doc: 'The target\'s width.' },
			{ name: 'getHeight', kind: 'method', signature: 'getHeight()', returns: 'Number', doc: 'The target\'s height.' },
			{ name: 'getDimensions', kind: 'method', signature: 'getDimensions()', doc: 'The target\'s width and height.' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'A description of the target.' }
		]
	},
	{
		name: 'Source',
		source: 'lumen',
		doc: 'A loaded sound.\n\nA sound that cannot find a free channel is dropped rather than raising: in a loud moment the least important effect should go missing, not the frame that triggered it.',
		methods: [
			{ name: 'play', kind: 'method', signature: 'play()', doc: 'Plays the sound.' },
			{ name: 'stop', kind: 'method', signature: 'stop()', doc: 'Stops the sound.' },
			{ name: 'pause', kind: 'method', signature: 'pause()', doc: 'Pauses the sound.' },
			{ name: 'resume', kind: 'method', signature: 'resume()', doc: 'Resumes the sound.' },
			{ name: 'isPlaying', kind: 'method', signature: 'isPlaying()', returns: 'Boolean', doc: 'Whether it is playing.' },
			{ name: 'isPaused', kind: 'method', signature: 'isPaused()', returns: 'Boolean', doc: 'Whether it is paused.' },
			{ name: 'setLooping', kind: 'method', signature: 'setLooping(looping)', doc: 'Sets whether it repeats.' },
			{ name: 'isLooping', kind: 'method', signature: 'isLooping()', returns: 'Boolean', doc: 'Whether it repeats.' },
			{ name: 'setVolume', kind: 'method', signature: 'setVolume(volume)', doc: 'Sets this sound\'s volume, 0 to 1.' },
			{ name: 'getVolume', kind: 'method', signature: 'getVolume()', returns: 'Number', doc: 'This sound\'s volume, 0 to 1.' },
			{ name: 'fadeIn', kind: 'method', signature: 'fadeIn(seconds)', doc: 'Plays, rising to full volume over `seconds`.' },
			{ name: 'fadeOut', kind: 'method', signature: 'fadeOut(seconds)', doc: 'Falls silent over `seconds`, then stops.' },
			{ name: 'clone', kind: 'method', signature: 'clone()', returns: 'Source', doc: 'A copy that plays independently.' },
			{ name: 'setPanning', kind: 'method', signature: 'setPanning(left, right)', doc: 'A volume per speaker, each 0 to 1, so `setPanning(1, 0)` is hard left. `\'static\'` sources only.' },
			{ name: 'setPosition', kind: 'method', signature: 'setPosition(angle, distance)', doc: 'Places a sound in the world: an angle in degrees where 0 is ahead and 90 is to the right, and a distance from 0 to 1. `\'static\'` sources only.' },
			{ name: 'clearEffects', kind: 'method', signature: 'clearEffects()', doc: 'Removes panning and positioning.' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'A description of the sound.' }
		]
	}
];

/**
 * Functions the engine calls by name. Every one is optional; a game defines
 * the ones it needs.
 *
 * @type {Callback[]}
 */
const CALLBACKS = [
	{ name: 'load', source: 'lumen', signature: 'function load()', doc: 'Runs once, before the first frame. Load assets and build initial state here.\n\nIf `load()` raises an error Lumen reports it and exits, rather than running a game whose state was never finished.' },
	{ name: 'update', source: 'lumen', signature: 'function update(dt)', doc: 'Runs every frame. `dt` is how many seconds the previous frame took.\n\n**Scale anything that moves by it.** A speed written as pixels-per-frame changes with the frame rate; a speed written as pixels-per-second does not. `dt` is capped at 0.25s, so a frame that stalls cannot teleport everything.' },
	{ name: 'draw', source: 'lumen', signature: 'function draw()', doc: 'Runs every frame, after `update()`. Draw the game here and change no state.' },
	{ name: 'keypressed', source: 'lumen', signature: 'function keypressed(key, isRepeat)', doc: 'A key went down.\n\nUse this rather than `keyboard.isDown()` for menus and dialogue: it fires once per physical press, where `isDown` is true on every frame the key is held.' },
	{ name: 'keyreleased', source: 'lumen', signature: 'function keyreleased(key)', doc: 'A key came up.' },
	{ name: 'textinput', source: 'lumen', signature: 'function textinput(text)', doc: 'Text was typed, between `keyboard.startTextInput()` and `keyboard.stopTextInput()`.' },
	{ name: 'mousepressed', source: 'lumen', signature: 'function mousepressed(x, y, button, clicks)', doc: 'A mouse button went down.' },
	{ name: 'mousereleased', source: 'lumen', signature: 'function mousereleased(x, y, button)', doc: 'A mouse button came up.' },
	{ name: 'mousemoved', source: 'lumen', signature: 'function mousemoved(x, y, dx, dy)', doc: 'The pointer moved. `dx` and `dy` are how far it moved since the last report.' },
	{ name: 'wheelmoved', source: 'lumen', signature: 'function wheelmoved(x, y)', doc: 'The wheel turned.' },
	{ name: 'resize', source: 'lumen', signature: 'function resize(width, height)', doc: 'The window was resized.' },
	{ name: 'focus', source: 'lumen', signature: 'function focus(hasFocus)', doc: 'The window gained or lost focus.' },
	{ name: 'joystickadded', source: 'lumen', signature: 'function joystickadded(count)', doc: 'A controller was plugged in.' },
	{ name: 'joystickremoved', source: 'lumen', signature: 'function joystickremoved(count)', doc: 'A controller was unplugged.' },
	{ name: 'quit', source: 'lumen', signature: 'function quit()', doc: 'The window was closed. Return `true` to cancel and keep the game running.' }
];

module.exports = { MODULES, MATH_EXTENSIONS, TYPES, CALLBACKS };
