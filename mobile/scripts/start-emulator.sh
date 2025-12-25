#!/usr/bin/env bash
set -euo pipefail

# Ajuste este nome se quiser outro AVD
AVD_NAME="Pixel_4_API_33"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"
EMULATOR="$ANDROID_SDK_ROOT/emulator/emulator"
ADB="$ANDROID_SDK_ROOT/platform-tools/adb"

# Verifica pré-requisitos
if [ ! -x "$EMULATOR" ]; then
  echo "Erro: emulador não encontrado em $EMULATOR"
  echo "Verifique ANDROID_SDK_ROOT e PATH ou instale o emulator"
  exit 1
fi
if [ ! -x "$ADB" ]; then
  echo "Erro: adb não encontrado em $ADB"
  exit 1
fi

# Mata emuladores offline / antigos (opcional)
# coleta a lista de devices e itera somente se houver linhas
devs=$($ADB devices | awk 'NR>1 {print $1 " " $2}')
if echo "$devs" | grep -qE "emulator-[0-9]+"; then
  echo "Verificando emuladores existentes..."
  echo "$devs" | grep -E "emulator-[0-9]+" | while read -r id st; do
    [ -z "$id" ] && continue
    if [ "$st" != "device" ]; then
      echo "Matando $id (estado: $st)"
      $ADB -s "$id" emu kill || true
    fi
  done
else
  echo "Nenhum emulador offline encontrado."
fi

# Inicia o emulador em background (comando simples e visível)
echo "Iniciando AVD: $AVD_NAME"
# Comando simples usado (igual ao que você pediu)
EMULATOR_CMD="$EMULATOR -avd $AVD_NAME -gpu host"
echo "Executando: $EMULATOR_CMD &"

mkdir -p "$HOME/.android"
# Se quiser ver o emulador em primeiro plano, exporte FOREGROUND=1 antes de rodar
if [ "${FOREGROUND:-0}" = "1" ]; then
  echo "Rodando em primeiro plano (sem nohup). Logs em $HOME/.android/emulator.log"
  "$EMULATOR" -avd "$AVD_NAME" -gpu host -no-snapshot -noaudio 2>&1 | tee "$HOME/.android/emulator.log"
  EMUPID=$!
else
  nohup $EMULATOR -avd "$AVD_NAME" -gpu host -no-snapshot -noaudio > "$HOME/.android/emulator.log" 2>&1 &
  EMUPID=$!
  echo "Emulator PID: $EMUPID (log: $HOME/.android/emulator.log)"
fi
sleep 1

# Espera o dispositivo aparecer no adb
echo "Aguardando adb listar o emulador..."
for i in {1..30}; do
  sleep 2
  $ADB devices | grep -q emulator && break
  echo -n "."
done
echo
$ADB devices

# Espera boot completo
echo "Aguardando boot completo (pode levar alguns minutos)..."
for i in {1..60}; do
  sleep 3
  BOOT=$($ADB -s emulator-5554 shell getprop sys.boot_completed 2>/dev/null || echo "")
  if [ "$BOOT" = "1" ]; then
    echo "Boot completo"
    break
  fi
  echo -n "."
done

if [ "$BOOT" != "1" ]; then
  echo "ATENÇÃO: O emulador não completou o boot em tempo esperado. Veja $HOME/.android/emulator.log"
  exit 2
fi

echo "Emulador pronto. Device:"
$ADB devices

# Opcional: abrir porta do Metro/Expo (não altera) - apenas dica
echo "Para rodar sua app com Expo: execute 'npx expo start' e então pressione 'a' ou rode 'npx expo run:android'"