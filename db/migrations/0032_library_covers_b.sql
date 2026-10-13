-- La ficha de Química de OpenStax no trae imagen propia; el libro sí.
UPDATE library_items
SET url = 'https://openstax.org/books/qu%C3%ADmica-2ed/pages/prefacio', source_url = 'https://openstax.org/books/qu%C3%ADmica-2ed/pages/prefacio', cover_url = NULL
WHERE url = 'https://openstax.org/details/books/qu%C3%ADmica-2ed';
