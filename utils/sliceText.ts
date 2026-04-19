export const sliceText = (text: string, number: number) => {
    if (text.length < number) {
        return text
    }
    return text.slice(0, number) + "..."
}