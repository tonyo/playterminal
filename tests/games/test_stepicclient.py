def test_login(stepic_client):
    assert not stepic_client._is_logged_in

    stepic_client._login()

    assert stepic_client._is_logged_in


def test_create_attempt(stepic_client):
    step_id = 18269  # multiple choice problem from Epic Guide

    attempt = stepic_client.create_attempt(step_id)

    assert attempt['step'] == step_id
    assert attempt['status'] == 'active'
    assert attempt['user']
