# node-speech-to-speech
The whole pipeline from microphone stream to synthesized speech, right on your fingertips

## Usage
It's highly recommended to use this with [PM2](https://www.npmjs.com/package/pm2)

For example:

1) `npm install`
2) `npm install pm2 -g`
3) `pm2 start record-mic.js --no-daemon --watch -- --input-sample-rate=48000 --input-lang-transcribe=en --input-lang-code=eng_Latn --input-device="INPUT 1/2" --output-device="CABLE-A Input"`

To fully kill the program process, you can use:
`pm2 delete record-mic`

## Options
`device-sample-rate` - your input and output devices sample rate in Hz. check your sound settings from Windows control panel

`hotkey` - (optional) a hotkey to hold to start buffering your speaking. Let it off to finish. Default value - *CAPS LOCK*

`input-lang-transcribe` - (optional) recommended to correctly define it for the optimal performance of a transcriber. Or leave it undefined for automatic detection. The format is the following: *en*, *fr*, etc.

`input-lang-code` - (optional) if defined needs to correspond with `input-lang-transcribe`, or undefined for automatic detection

`output-lang-code` - (optional) a language to which a transcribed text will be translated to. Defaults to *fra_Latn* (French)

`output-lang-speech` - (optional) the language that will be spoken by AI. When defined it should correspond with `output-lang-code`, otherwise the TTS system will try to automatically detect the language. The format is the following: *en*, *fr*, etc.

`input-device` - (optional) the program will try to search your input device according to this parameter. If left undefined, a default input device will be used (configured in OS)

`output-device` - (optional) output device to use. If left undefined, a default output device will be used (configured in OS)

## Recommendations
To be used inside voice chat apps like Discord, you will need a virtual audio input device that will be a target for this program.
VB-Cable is a free software which is confirmed to be working as of now on Windows 11:

https://vb-audio.com/Cable/

Here's how to use it:

1) install at least one pair of virtual input and output devices
2) Go to *control panel*, *sound settings*, *playback* tab and double click the entry with the virtual device name you defined during installation (*CABLE-A Input*, for example)
3) Copy the name and set it as `output-device` in the script options
4) Navigate to `advanced` tab and use the given sample rate as `device-sample-rate`
5) (Optional) If you want to hear synthesized speech output yourself: close the window, go to *recording* tab, double click your installed virtual device (*CABLE-A Output*, for example), then *listen* tab and check *Listen to this device*.

Check sample rate the same way as defined in *4)* and make sure it's equal to what's defined in `device-sample-rate`

Also, you can make this device as your default input device by right clicking on it and selecting both *Set as Default Device* and *Set as Default Communication Device*. That way you won't have to reconfigure your VC apps (unless you're already using specific options there).

## Useful data
Supported language codes to be used in options `input-lang-code` and `output-lang-code`
https://github.com/facebookresearch/flores/blob/main/flores200/README.md#languages-in-flores-200