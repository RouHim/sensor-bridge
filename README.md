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

## Protocols

### Configuration protocol

This is an example of the configuration to be send to the arduino board.

Synopsis:

```
ci{address_1}{font_size_1},{address_2}{font_size_2},...,{address_n}{font_size_n
```
Where:
* `c` is the configuration command
* `i` is the configuration type (Values: `i` for I2C display)
* `address` is the address of the I2C display
* `font_size` is the font size to be used (Values: 0, 1, 2)

Example:
```
ci0x3C0,0x3C1,0x3C2;
```

### Data protocol

This is an example of the date to be send to the arduino board.
The data is send as a string of bytes.

Synopsis:

```   
di{sensor_value_1},{sensor_value_2},...,{sensor_value_n};
```

Where:
* `d` is the data command
* `i` is the data type (Values: `i` for I2C display)
* `sensor_value` is the value of the sensor to be displayed

Example:

```
di5%,50C;
```
