import { actions } from 'astro:actions'
import { handleActionError, showErrorDialog } from '@/assets/scripts/actions'

const loginForm = document.querySelector('form')
if (loginForm !== null) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    event.stopPropagation()
    const form = new FormData(loginForm)

    // Validate the form data
    const token = form.get('token') as string
    if (token === null) {
      return showErrorDialog('Invalid access, please refresh the page')
    }
    const email = form.get('email') as string
    if (email === null) {
      return showErrorDialog('The email is required')
    }
    const password = form.get('password') as string
    if (password === null) {
      return showErrorDialog('The password is required')
    }

    const { error } = await actions.auth.signIn({ token, email, password })
    if (error) {
      return handleActionError(error, () => location.reload())
    }

    const urlParams = new URLSearchParams(window.location.search)
    const redirect = urlParams.get('redirect_to') || '/'
    return (location.href = redirect)
  })
}
