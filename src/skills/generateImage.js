import { env } from 'process'; // eslint-disable-line no-undef

const sd_url = env.SDAPI_URL || 'http://127.0.0.1:7860';
const sd_username = env.SDAPI_USR;
const sd_password = env.SDAPI_PWD;

export default async function generateImage({ prompt, seed = -1, subseed = -1, subseed_strength = 0, steps = 30, width = 512, height = 512, pag_scale = 7.5, negative_prompt = 'painting, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, deformed, ugly, blurry, bad anatomy, bad proportions, extra limbs, cloned face, skinny, glitchy, double torso, extra arms, extra hands, mangled fingers, missing lips, ugly face, distorted face, extra legs' }) {
  try {
    const method = 'POST';
    const headers = new Headers();
    const body = JSON.stringify({
      "prompt": prompt,
      "negative_prompt": negative_prompt,
      "seed": seed,
      "subseed": subseed,
      "subseed_strength": subseed_strength,
      // "seed_resize_from_h": -1,
      // "seed_resize_from_w": -1,
      "batch_size": 1,
      // "n_iter": 1,
      "steps": steps,
      // "clip_skip": 1,
      "width": width,
      "height": height,
      // "sampler_index": 0,
      // "sampler_name": "DPM++ 2M SDE",
      // "schedule": "Karras",            // Schedule recomendado: "Karras" ou "Exponential"
      // "hr_sampler_name": "Same as primary",
      // "eta": 0,
      // "cfg_scale": 3.0,                // CFG recomendado: 2.0 ou 3.0
      // "cfg_end": 1,
      // "diffusers_guidance_rescale": 0.7,
      "pag_scale": pag_scale,                // Perturbed Attention Guidance (PAG)
      // "pag_adaptive": 0.5,             // Ajuste adaptativo para PAG
      // "styles": [],
      // "tiling": false,
      // "vae_type": "Full",
      // "hidiffusion": false,
      // "do_not_reload_embeddings": false,
      // "restore_faces": false,
      // "detailer_enabled": false,
      // "detailer_prompt": "",
      // "detailer_negative": "",
      // "detailer_steps": 10,
      // "detailer_strength": 0.3,
      // "hdr_mode": 0,
      // "hdr_brightness": 0,
      // "hdr_color": 0,
      // "hdr_sharpen": 0,
      // "hdr_clamp": false,
      // "hdr_boundary": 4,
      // "hdr_threshold": 0.95,
      // "hdr_maximize": false,
      // "hdr_max_center": 0.6,
      // "hdr_max_boundry": 1,
      // "hdr_color_picker": "string",
      // "hdr_tint_ratio": 0,
      // "init_images": [
      //   "string"
      // ],
      // "resize_mode": 0,
      // "resize_name": "None",
      // "resize_context": "None",
      // "denoising_strength": 0.3,
      // "image_cfg_scale": 0,
      // "initial_noise_multiplier": 0,
      // "scale_by": 1,
      // "selected_scale_tab": 0,
      // "mask": "string",
      // "latent_mask": "string",
      // "mask_for_overlay": "string",
      // "mask_blur": 4,
      // "paste_to": "string",
      // "inpainting_fill": 0,
      // "inpaint_full_res": false,
      // "inpaint_full_res_padding": 0,
      // "inpainting_mask_invert": 0,
      // "overlay_images": "string",
      // "enable_hr": false,
      // "firstphase_width": 0,
      // "firstphase_height": 0,
      // "hr_scale": 2,
      // "hr_force": false,
      // "hr_resize_mode": 0,
      // "hr_resize_context": "None",
      // "hr_upscaler": "string",
      // "hr_second_pass_steps": 0,
      // "hr_resize_x": 0,
      // "hr_resize_y": 0,
      // "hr_denoising_strength": 0,
      // "refiner_steps": 5,
      // "refiner_start": 0,
      // "refiner_prompt": "",
      // "refiner_negative": "",
      // "hr_refiner_start": 0,
      // "do_not_save_samples": false,
      // "do_not_save_grid": false,
      // "script_args": [],
      // "override_settings": {},
      // "override_settings_restore_afterwards": true,
      // "script_name": "none",
      // "send_images": true,
      // "save_images": false,
      // "alwayson_scripts": {},
      // "ip_adapter": [
      //   {
      //     "adapter": "Base",
      //     "images": [],
      //     "masks": [],
      //     "scale": 0.5,
      //     "start": 0,
      //     "end": 1,
      //     "crop": false
      //   }
      // ],
      // "face": {
      //   "mode": "FaceID",
      //   "source_images": [
      //     "string"
      //   ],
      //   "ip_model": "FaceID Base",
      //   "ip_override_sampler": true,
      //   "ip_cache_model": true,
      //   "ip_strength": 1,
      //   "ip_structure": 1,
      //   "id_strength": 1,
      //   "id_conditioning": 0.5,
      //   "id_cache": true,
      //   "pm_trigger": "person",
      //   "pm_strength": 1,
      //   "pm_start": 0.5,
      //   "fs_cache": true
      // },
      // "extra": {}
    });

    headers.set('Content-Type', 'application/json');
    if (sd_username && sd_password) {
      headers.set('Authorization', `Basic ${btoa(`${sd_username}:${sd_password}`)}`);
    }

    const res = await fetch(`${sd_url}/sdapi/v1/txt2img`, { method, headers, body });
    if (res.status !== 200) {
      throw new Error(`Error: ${res.status}`);
    }

    const json = await res.json();
    console.log(json)
    return json.images[0];
  } catch (err) {
    console.log(err.message)
    return { error: err.message || 'Erro desconhecido', stack: err.stack || undefined };
  }
}