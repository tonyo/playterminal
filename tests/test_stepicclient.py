def test_login(client):
    assert not client._is_logged_in

    client._login()

    assert client._is_logged_in
