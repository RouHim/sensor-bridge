#![allow(non_camel_case_types)]
#![allow(non_snake_case)]

extern crate native_windows_gui as nwg;
extern crate native_windows_derive as nwd;

use std::borrow::Borrow;
use std::collections::HashMap;
use std::io::Write;
use std::thread;

use nwg::{ListBox, NativeUi};
use wmi::{COMLibrary, Variant, WMIConnection};

use crate::aida64::Aida64Sensor;

mod aida64;
mod serial_port;

#[derive(Default)]
pub struct MyApp {
    window: nwg::Window,
    layout: nwg::GridLayout,

    listbox_ports: ListBox<String>,
    listbox_sensors: ListBox<Aida64Sensor>,
    btn_refresh_ports: nwg::Button,
}

impl MyApp {
    fn exit(&self) {
        nwg::stop_thread_dispatch();
    }

    fn refresh_ports(&self) {
        let port_list = serial_port::list_ports();
        let ports: Vec<String> = port_list.iter().map(|port| port.port_name.clone()).collect();
        self.listbox_ports.set_collection(ports);
    }

    fn refresh_sensors(listbox_sensors: &ListBox<Aida64Sensor>) {
        let sensors = thread::spawn(move || {
            let aida_con = aida64::connect();
            aida64::read_sensors(&aida_con)
        }).join();
        let sensors = sensors.unwrap();
        listbox_sensors.set_collection(sensors);
    }
}

fn main() {
    nwg::init().expect("Failed to init Native Windows GUI");
    nwg::Font::set_global_family("Segoe UI").expect("Failed to set default font");

    let _app = MyApp::build_ui(Default::default()).expect("Failed to build UI");
    nwg::dispatch_thread_events();
}

mod my_app_ui {
    use std::cell::RefCell;
    use std::collections::HashMap;
    use std::ops::Deref;
    use std::rc::Rc;
    use std::thread;

    use native_windows_gui as nwg;
    use wmi::{COMLibrary, Variant, WMIConnection};

    use super::*;

    pub struct MyAppUi {
        inner: Rc<MyApp>,
        default_handler: RefCell<Vec<nwg::EventHandler>>,
    }

    impl NativeUi<MyAppUi> for MyApp {
        fn build_ui(mut data: MyApp) -> Result<MyAppUi, nwg::NwgError> {
            use nwg::Event as E;

            // Controls
            nwg::Window::builder()
                .size((300, 150))
                .position((300, 300))
                .title("MyApp")
                .build(&mut data.window).unwrap();

            nwg::Button::builder()
                .text("Refresh")
                .parent(&data.window)
                .focus(true)
                .build(&mut data.btn_refresh_ports).unwrap();

            // List of ports
            ListBox::builder()
                .collection(vec![])
                .parent(&data.window)
                .focus(true)
                .build(&mut data.listbox_ports).unwrap();

            // List of sensor values
            ListBox::builder()
                .collection(vec![])
                .parent(&data.window)
                .focus(true)
                .build(&mut data.listbox_sensors).unwrap();

            // Wrap-up
            let ui = MyAppUi {
                inner: Rc::new(data),
                default_handler: Default::default(),
            };

            // Events
            let window_handles = [&ui.window.handle];
            for handle in window_handles.iter() {
                let evt_ui = Rc::downgrade(&ui.inner);
                let handle_events = move |evt, _evt_data, handle| {
                    if let Some(evt_ui) = evt_ui.upgrade() {
                        match evt {
                            E::OnInit => {
                                MyApp::refresh_ports(&evt_ui);
                                MyApp::refresh_sensors(&evt_ui.listbox_sensors);
                            }
                            E::OnButtonClick =>
                                if &handle == &evt_ui.btn_refresh_ports { MyApp::refresh_ports(&evt_ui); }
                            E::OnWindowClose =>
                                if &handle == &evt_ui.window {
                                    MyApp::exit(&evt_ui);
                                },
                            _ => {}
                        }
                    }
                };

                ui.default_handler.borrow_mut().push(
                    nwg::full_bind_event_handler(handle, handle_events)
                );
            }

            // Layouts
            nwg::GridLayout::builder()
                .parent(&ui.window)
                .spacing(2)
                .min_size([150, 140])
                .child(0, 0, &ui.btn_refresh_ports)
                .child(0, 1, &ui.listbox_ports)
                .child(1, 1, &ui.listbox_sensors)
                .build(&ui.layout)?;

            Ok(ui)
        }
    }

    impl Deref for MyAppUi {
        type Target = MyApp;
        fn deref(&self) -> &MyApp {
            &self.inner
        }
    }
}