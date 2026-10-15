<?php

test('redirects to the damas game', function () {
    $response = $this->get(route('home'));

    $response->assertRedirect('/damas');
});
