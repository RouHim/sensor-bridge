use assertor::{assert_that, BooleanAssertion, ComparableAssertion};

use crate::fonts;

#[test]
fn test_font_installed() {
    // GIVEN is font that is already known to the system
    let all_fonts = fonts::get_all();
    let font_name = all_fonts.first().unwrap();

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
