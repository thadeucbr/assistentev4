#!/usr/bin/env python3
"""
Script para geração de áudio usando Google Text-to-Speech (gTTS)
Aceita texto como argumento e salva o áudio em formato WAV
"""

import sys
import os
import argparse
import tempfile
import subprocess
from gtts import gTTS

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
        
        # Encontra o ffmpeg (compatível com Docker e local)
        ffmpeg_paths = [
            os.path.join(os.getcwd(), 'node_modules', '@ffmpeg-installer', 'linux-x64', 'ffmpeg'),
            '/usr/bin/ffmpeg',
            'ffmpeg'
        ]
        
        project_ffmpeg = None
        for ffmpeg_path in ffmpeg_paths:
            if os.path.exists(ffmpeg_path) or ffmpeg_path == 'ffmpeg':
                project_ffmpeg = ffmpeg_path
                break
        
        if not project_ffmpeg:
            raise Exception("ffmpeg não encontrado")
        
        print(f"Usando ffmpeg: {project_ffmpeg}")
        
        # Cria o objeto gTTS com configurações básicas
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
            # Converte MP3 para WAV usando ffmpeg com configurações básicas
            cmd = [
                project_ffmpeg,
                '-i', temp_mp3_path,
                '-acodec', 'pcm_s16le',  # Codec WAV padrão
                '-ar', '16000',          # Sample rate básico
                '-ac', '1',              # Mono
                '-y',                    # Sobrescrever arquivo se existir
                args.output
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                raise Exception(f"Erro ao converter áudio: {result.stderr}")
            
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
