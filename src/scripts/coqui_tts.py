#!/usr/bin/env python3
"""
Script para geração de áudio usando Google Text-to-Speech (gTTS)
Aceita texto como argumento e salva o áudio em formato WAV
"""

import sys
import os
import argparse
import tempfile
from gtts import gTTS
from pydub import AudioSegment

def main():
    parser = argparse.ArgumentParser(description='Gera áudio usando Google TTS')
    parser.add_argument('--text', required=True, help='Texto para converter em áudio')
    parser.add_argument('--output', required=True, help='Caminho do arquivo de saída')
    parser.add_argument('--language', default='pt-br', help='Idioma (pt-br para português brasileiro)')
    parser.add_argument('--slow', action='store_true', help='Fala mais devagar')
    
    args = parser.parse_args()
    
    try:
        print(f"Inicializando Google TTS com idioma: {args.language}")
        print(f"Gerando áudio para: '{args.text}'")
        
        # Cria o objeto gTTS
        tts = gTTS(
            text=args.text,
            lang=args.language,
            slow=args.slow
        )
        
        # Salva em um arquivo temporário MP3 primeiro
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_mp3:
            temp_mp3_path = temp_mp3.name
            tts.save(temp_mp3_path)
        
        try:
            # Converte MP3 para WAV usando pydub
            audio = AudioSegment.from_mp3(temp_mp3_path)
            
            # Configura para qualidade adequada para WhatsApp
            audio = audio.set_frame_rate(16000)  # 16kHz é bom para voz
            audio = audio.set_channels(1)  # Mono
            
            # Salva como WAV
            audio.export(args.output, format="wav")
            
            print(f"Áudio salvo em: {args.output}")
            print("SUCCESS")
            
        finally:
            # Remove o arquivo temporário
            try:
                os.unlink(temp_mp3_path)
            except:
                pass
        
    except Exception as e:
        print(f"ERRO: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
