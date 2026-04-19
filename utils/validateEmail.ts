const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function validateEmail(email: string) {
    if (emailRegex.test(email)) {
        return true
    } else {
        return false
    }
}