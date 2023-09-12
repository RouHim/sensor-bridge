use assertor::{assert_that, BooleanAssertion, ComparableAssertion};

use crate::fonts;

#[test]
fn test_font_installed() {
    // GIVEN is font that is already known to the system
    let font_name = "Arial";
    let mut font_data = vec![];
    ureq::get("https://raw.githubusercontent.com/root-project/root/master/fonts/arial.ttf")
        .call()
        .unwrap()
        .into_reader()
        .read_to_end(&mut font_data)
        .unwrap();
    fonts::install_font(font_name, &font_data);

    // WHEN looking for the font
    let font_exists = fonts::exists(font_name);

    // THEN the font should be found
    assert_that!(font_exists).is_true();
}

#[test]
fn test_font_not_installed() {
    // GIVEN is font that is not known to the system
    let font_name = "Some unknown font :)";

    // WHEN looking for the font
    let font_exists = fonts::exists(font_name);

    // THEN the font should be found
    assert_that!(font_exists).is_false();
}

#[test]
fn test_load_font_data() {
    // GIVEN is font that is already known to the system
    let font_name = "Arial";

    // WHEN loading the font data
    let font_exists = fonts::load_data(font_name);

    // THEN the font should be found
    assert_that!(font_exists.len()).is_greater_than(0);
}

#[test]
fn test_get_all_fonts() {
    // GIVEN is nothing

    // WHEN loading the all fonts
    let font_exists = fonts::get_all();

    // THEN the font should be found
    assert_that!(font_exists.len()).is_greater_than(0);
}
