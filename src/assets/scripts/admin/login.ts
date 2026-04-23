import { actions, handleActionError, showErrorDialog } from '@/assets/scripts/shared/actions'

const loginForm = document.querySelector('form')
if (loginForm !== null) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    event.stopPropagation()
    const form = new FormData(loginForm)

    // Validate the form data
    const email = form.get('email') as string
    if (email === null) {
      return showErrorDialog('The email is required')
    }
    const password = form.get('password') as string
    if (password === null) {
      return showErrorDialog('The password is required')
    }

    const { data, error } = await actions.auth.signIn({ email, password })
    if (error) {
      return handleActionError(error, () => location.reload())
    }

    const urlParams = new URLSearchParams(window.location.search)
    const redirect = urlParams.get('redirect_to') || data?.redirectTo || '/'
    return (location.href = redirect)
  })
}
