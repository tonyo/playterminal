def test_login(client):
    assert not client._is_logged_in

    client._login()

    assert client._is_logged_in


def test_create_attempt(client):
    step_id = 18269  # multiple choice problem from Epic Guide

    attempt = client.create_attempt(step_id)

    assert attempt['step'] == step_id
    assert attempt['status'] == 'active'
    assert attempt['user']
