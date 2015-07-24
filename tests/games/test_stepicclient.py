def test_login(stepic_client):
    assert not stepic_client._is_logged_in

    stepic_client._login()

    assert stepic_client._is_logged_in


def test_get_non_existent_attempt(stepic_client):
    attempt_id = 2718281828459

    attempt = stepic_client.get_attempt(attempt_id)

    assert attempt is None


def test_get_attempt(stepic_client):
    attempt_id = 4729799

    attempt = stepic_client.get_attempt(attempt_id)

    assert attempt['id'] == attempt_id
    assert attempt['status'] == 'cleanedup'


def test_create_attempt(stepic_client):
    step_id = 18269  # multiple choice problem from Epic Guide

    attempt = stepic_client.create_attempt(step_id)

    assert attempt['step'] == step_id
    assert attempt['status'] == 'active'
    assert attempt['user']
