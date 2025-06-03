import { pipeline } from '@huggingface/transformers'
import * as Echogarden from 'echogarden'
import portAudio from 'naudiodon2'
import { Whisper, manager } from 'smart-whisper'
import { Readable } from 'stream'
import waveResampler from 'wave-resampler'
import commandLineArgs from 'command-line-args'

import { addHotkeyDownListener, addHotkeyUpListener } from './key-listener.js'

const optionDefinitions = [
  { name: 'input-sample-rate', type: Number },
  { name: 'hotkey', type: String, alias: 'h', defaultValue: 'CAPS LOCK' },
  { name: 'input-lang-transcribe', type: String, defaultValue: undefined },
  { name: 'output-lang-speech', type: String, defaultValue: undefined },
  { name: 'input-lang-code', type: String, defaultValue: undefined },
  { name: 'output-lang-code', type: String, defaultValue: 'fra_Latn' },
  { name: 'input-device', type: String, defaultValue: undefined },
  { name: 'output-device', type: String, defaultValue: undefined },
]
const options = commandLineArgs(optionDefinitions)

console.info('RECEIVED OPTIONS', options)

const DEVICE_SAMPLE_RATE = options['input-sample-rate']

const HOTKEY = options['hotkey']

const IN_LANG_TRANSCRIBE = options['input-lang-transcribe']
const OUT_LANG_SPEECH = options['output-lang-speech']
const IN_LANG_CODE = options['input-lang-code']
const OUT_LANG_CODE = options['output-lang-code']

const INPUT_DEVICE = options['input-device']
const OUTPUT_DEVICE = options['output-device']

const devices = portAudio.getDevices()
// TODO: implement converting stereo input to mono so the user doesn't have to guess to which Audio Interface port connect a microphone to
// Choosing WASAPI devices as opening a WINDOWS WDM-KS stream throws an error
const inputDevice = INPUT_DEVICE
  ? devices.find(({ name, maxInputChannels, hostAPIName }) => hostAPIName === 'Windows WASAPI' && name.includes(INPUT_DEVICE) && maxInputChannels)
  : -1
const outputDevice = OUTPUT_DEVICE
  ? devices.find(({ name, maxOutputChannels, hostAPIName }) => hostAPIName === 'Windows WASAPI' && name.includes(OUTPUT_DEVICE) && maxOutputChannels)
  : -1

let ai

const createAi = () => {
  ai = new portAudio.AudioIO({
    inOptions: {
      channelCount: 1,
      deviceId: inputDevice.id,
      sampleRate: DEVICE_SAMPLE_RATE,
      sampleFormat: portAudio.SampleFormatFloat32,
    }
  })
}

const translate = await pipeline('translation', 'Xenova/nllb-200-distilled-600M')

const audioBuffer = []
const rs = new Readable()
rs._read = () => { }

// Instantiate Whisper
console.warn('FETCHING WHISPER MODEL. PLEASE, DO NOT INTERRUPT')
const model = await manager.download('tiny')
console.info('FINISHED FETCHING WHISPER MODEL')
const whisper = new Whisper(manager.resolve(model), { gpu: true })

// Alternatively you can load custom models (quantized, for example) like this:
// const model = path.resolve('/path/to/model/model_name.bin')
// const whisper = new Whisper(model, { gpu: true })

let holdingHotkey = false

//Start streaming
addHotkeyDownListener(HOTKEY, () => {
  if (holdingHotkey) {
    return
  }
  console.log('HOTKEY DOWN EVENT FIRED')
  holdingHotkey = true

  createAi()
  ai.on('data', (chunk) => {
    audioBuffer.push(chunk)
    rs.push(chunk)
  })
  ai.start()
})

function convertFloat64ToFloat32(input64) {
  const output32 = new Float32Array(input64.length);
  for (let i = 0; i < input64.length; i++) {
    output32[i] = input64[i]; // Automatic truncation to Float32 precision
  }
  return output32;
}

addHotkeyUpListener(HOTKEY, () => {
  holdingHotkey = false
  console.log('HOTKEY UP EVENT HANDLER FIRED')

  ai.quit()
  createAi()

  const transcribe = async () => {
    const pcm = new Float32Array(Buffer.concat(audioBuffer).buffer)
    const resampledPcm = convertFloat64ToFloat32(waveResampler.resample(pcm, DEVICE_SAMPLE_RATE, 16000))

    audioBuffer.splice(0, audioBuffer.length) // Reset for next usage

    const { result } = await whisper.transcribe(resampledPcm, { language: IN_LANG_TRANSCRIBE, n_threads: 16 })

    const res = await result

    let text = res.map(({ text }) => text)

    const translatedTexts = await translate(text, {
      src_lang: IN_LANG_CODE,
      tgt_lang: OUT_LANG_CODE,
      max_length: 1024,
      max_new_tokens: 2048,
      num_beams: 8,
    })
    const translatedText = translatedTexts.map(({ translation_text }) => translation_text)
    console.log('TEXT TRANSLATED', { text, translatedText })

    // https://huggingface.co/rhasspy/piper-voices/tree/main Available voices for VITS engine (supply to the `voice` parameter)
    // https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md Available voices fot Kokoro engine
    // VITS has broader language support while Kokoro offers the highest quality voice models
    const voice = await Echogarden.synthesize(translatedText, { engine: 'vits', language: OUT_LANG_SPEECH })

    const upSampledVoice = convertFloat64ToFloat32(
      waveResampler.resample(voice.audio.audioChannels[0], voice.audio.sampleRate, DEVICE_SAMPLE_RATE)
    )

    const ao = new portAudio.AudioIO({
      outOptions: {
        sampleRate: DEVICE_SAMPLE_RATE,
        deviceId: outputDevice.id,
        channelCount: 1,
        sampleFormat: portAudio.SampleFormatFloat32,
        maxQueue: 32,
      }
    })

    setTimeout(async () => { // Play after microphone stream finishes playing
      const rs_ = Readable.from(Buffer.from(upSampledVoice.buffer)) // Doesn't seem to work well
      rs_.pipe(ao)
    }, 200)

    // When audio output is not last step, instead of piping we can synchronously read from buffer and write into ao to avoid underflow
    ao.start()
  }

  transcribe()
})