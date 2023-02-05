# sensor bridge

This is a simple ui application that allows to configure dataflow between aida64 sensors written to the shared memory,
and a arduino board that is connected to the computer via serial port.

## Installation

1. Install [AIDA64](https://www.aida64.com/downloads) and [Arduino IDE](https://www.arduino.cc/en/Main/Software)
2. Download the [latest release](https://github.com/RouHim/sensor-bridge/releases/latest)
3. Execute the `sensor-bridge.exe` file

## Usage

1. Connect the arduino board to the computer via serial port
2. Make sure the arduino board is running the [sensor-display](https://github.com/RouHim/sensor-display) software
3. Open the `sensor-bridge.exe` file
4. Select the serial port that the arduino board is connected to
5. Select the sensors that you want to display
6. Make sure the baud rate matches the one in the `sensor-display` software (usually 125000)
7. Click the `Connect` button
8. The `sensor-display` software should now display the selected sensors
9. You can now minimize the `sensor-bridge` application
